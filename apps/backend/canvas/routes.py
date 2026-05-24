# apps/backend/canvas/routes.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
import json
import logging
import asyncio
import struct

from .utils import FULL_IMAGE_SIZE

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()
connected_clients = set()


def _is_pixel_batch(binary_data: bytes) -> bool:
    data_len = len(binary_data)
    if data_len < 7 or (data_len - 2) % 5 != 0:
        return False
    if data_len == FULL_IMAGE_SIZE:
        return False
    return True


@router.websocket("/ws/canvas")
async def websocket_endpoint(websocket: WebSocket):
    """
    Entry point for all websocket connections. Establishes a connection with the client.
    Accepts connections, sends initial data, and handles updates.
    Possible messages:
    - text: JSON object with type and data
    - bytes: binary data
    """
    await websocket.accept()
    connected_clients.add(websocket)

    try:
        from .utils import get_canvas

        canvas = await get_canvas()

        binary_data = bytearray()
        pixel_count = 0

        for y in range(64):
            for x in range(64):
                r, g, b = canvas[y][x]
                if r != 0 or g != 0 or b != 0:
                    binary_data.extend(struct.pack("BBBBB", x, y, r, g, b))
                    pixel_count += 1

        final_data = struct.pack("H", pixel_count) + binary_data

        logger.info(
            f"Sending binary init message with {pixel_count} pixels, size: {len(final_data)} bytes"
        )

        await websocket.send_bytes(final_data)
        await asyncio.sleep(1.0)  # Delay for ESP32

        while True:
            message = await websocket.receive()

            if message["type"] == "websocket.receive":
                if "text" in message:
                    data = json.loads(message["text"])

                    if data.get("type") == "pixel_update":
                        x = data["x"]
                        y = data["y"]
                        r = data["r"]
                        g = data["g"]
                        b = data["b"]
                        from .utils import update_pixel, broadcast_canvas_update

                        update_pixel(x, y, r, g, b)
                        await broadcast_canvas_update(x, y, r, g, b, websocket)

                elif "bytes" in message:
                    binary_data = message["bytes"]
                    data_len = len(binary_data)

                    if data_len == 5:
                        x, y, r, g, b = struct.unpack("BBBBB", binary_data)
                        from .utils import update_pixel, broadcast_canvas_update

                        update_pixel(x, y, r, g, b)
                        await broadcast_canvas_update(x, y, r, g, b, websocket)

                    elif data_len == FULL_IMAGE_SIZE:
                        from .utils import handle_binary_image_update

                        await handle_binary_image_update(binary_data, websocket)

                    elif _is_pixel_batch(binary_data):
                        from .utils import handle_binary_pixel_batch

                        await handle_binary_pixel_batch(binary_data, websocket)

    except WebSocketDisconnect:
        connected_clients.remove(websocket)
        logger.info(f"Client disconnected. Total clients: {len(connected_clients)}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        if websocket in connected_clients:
            connected_clients.remove(websocket)


@router.post("/reset")
async def reset_canvas():
    """Reset the canvas to all black and broadcast the updated state to all clients."""
    from .utils import reset_canvas, broadcast_reset

    await reset_canvas()
    await broadcast_reset()
    return JSONResponse(content={"message": "Canvas reset successfully"})
