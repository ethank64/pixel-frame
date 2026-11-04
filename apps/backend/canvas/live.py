# apps/backend/canvas/live.py
"""
Live webcam streaming to the frame.

One person streams at a time, for up to LIVE_TURN_SECONDS. Their frames go only to the
physical frame (never saved to the canvas or sent to browsers). When the turn ends, the
frame gets the saved canvas back as a full image update.

Live frame format: b"LV" followed by 64*64 RGB565 pixels, little-endian, row by row.
"""
import asyncio
import json
import logging
import os
import time

logger = logging.getLogger(__name__)

LIVE_FRAME_MAGIC = b"LV"
LIVE_FRAME_SIZE = 2 + 64 * 64 * 2
LIVE_TURN_SECONDS = int(os.environ.get("LIVE_TURN_SECONDS", "180"))

# The physical frame(s), told apart from browsers by the User-Agent the firmware sends
frame_clients = set()

_owner = None
_ends_at = 0.0
_turn_task: asyncio.Task | None = None
# Frames still being sent to a frame client; new frames for it are dropped until it catches up
_busy_frames = set()


def is_frame_client(websocket) -> bool:
    user_agents = websocket.headers.getlist("user-agent")
    return any("ESP32" in ua or "arduino-WebSocket" in ua for ua in user_agents)


def is_live() -> bool:
    return _owner is not None


def is_live_frame(binary_data: bytes) -> bool:
    return len(binary_data) == LIVE_FRAME_SIZE and binary_data[:2] == LIVE_FRAME_MAGIC


def _status_for(websocket) -> str:
    seconds_left = max(0, round(_ends_at - time.monotonic())) if is_live() else 0
    return json.dumps(
        {
            "type": "live_status",
            "active": is_live(),
            "you": websocket is _owner,
            "seconds_left": seconds_left,
        }
    )


async def send_status(websocket):
    try:
        await websocket.send_text(_status_for(websocket))
    except Exception:
        pass


async def broadcast_status():
    from .routes import connected_clients

    browsers = [c for c in connected_clients if c not in frame_clients]
    await asyncio.gather(*(send_status(c) for c in browsers))


async def start(websocket):
    """Give the requester the live turn if nobody else has it."""
    global _owner, _ends_at, _turn_task

    if _owner is not None and _owner is not websocket:
        await send_status(websocket)
        return

    if _owner is None:
        _owner = websocket
        _ends_at = time.monotonic() + LIVE_TURN_SECONDS
        _turn_task = asyncio.create_task(_end_after_turn())
        logger.info("Live stream started")

    await broadcast_status()


async def stop(websocket):
    """End the live turn if the requester holds it."""
    if websocket is _owner:
        await end()


async def end():
    """End the current live turn and put the saved canvas back on the frame."""
    global _owner, _turn_task

    if _owner is None:
        return

    _owner = None
    if _turn_task is not None and _turn_task is not asyncio.current_task():
        _turn_task.cancel()
    _turn_task = None
    logger.info("Live stream ended")

    from .utils import encode_full_canvas

    restore = encode_full_canvas()
    await asyncio.gather(
        *(frame.send_bytes(restore) for frame in list(frame_clients)),
        return_exceptions=True,
    )
    await broadcast_status()


async def _end_after_turn():
    await asyncio.sleep(LIVE_TURN_SECONDS)
    await end()


async def relay_frame(binary_data: bytes, sender):
    """Forward a live frame from the streamer to the frame, skipping frames a slow frame can't keep up with."""
    if sender is not _owner:
        return

    for frame in list(frame_clients):
        if frame in _busy_frames:
            continue
        _busy_frames.add(frame)
        asyncio.create_task(_send_frame(frame, binary_data))


async def _send_frame(frame, binary_data: bytes):
    try:
        await frame.send_bytes(binary_data)
    except Exception as e:
        logger.warning(f"Failed to send live frame: {e}")
    finally:
        _busy_frames.discard(frame)


async def handle_disconnect(websocket):
    frame_clients.discard(websocket)
    _busy_frames.discard(websocket)
    if websocket is _owner:
        await end()
