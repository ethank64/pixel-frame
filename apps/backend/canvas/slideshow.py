import asyncio
import struct
import uuid
from dataclasses import dataclass, field

SLIDESHOW_MAGIC = b"\xff\xfd"
SLIDESHOW_FRAME_SIZE = 2 + 4 + 4 + 64 * 64 * 5
DEFAULT_DISPLAY_MS = 30_000
DEFAULT_TRANSITION_MS = 3_000


@dataclass
class QueueImage:
    id: str
    name: str
    canvas: list[list[tuple[int, int, int]]]


@dataclass
class SlideshowState:
    queue: list[QueueImage] = field(default_factory=list)
    running: bool = False
    current_index: int = 0
    display_ms: int = DEFAULT_DISPLAY_MS
    transition_ms: int = DEFAULT_TRANSITION_MS
    task: asyncio.Task | None = None


state = SlideshowState()


def encode_slideshow_frame(
    canvas: list[list[tuple[int, int, int]]],
    transition_ms: int,
    display_ms: int,
) -> bytes:
    payload = bytearray(SLIDESHOW_FRAME_SIZE)
    payload[0:2] = SLIDESHOW_MAGIC
    struct.pack_into("<I", payload, 2, transition_ms)
    struct.pack_into("<I", payload, 6, display_ms)

    offset = 10
    for y in range(64):
        for x in range(64):
            r, g, b = canvas[y][x]
            payload[offset : offset + 5] = struct.pack("BBBBB", x, y, r, g, b)
            offset += 5

    return bytes(payload)


def decode_image_binary(binary_data: bytes) -> list[list[tuple[int, int, int]]]:
    from .utils import FULL_IMAGE_SIZE

    if len(binary_data) != FULL_IMAGE_SIZE:
        raise ValueError(f"Expected {FULL_IMAGE_SIZE} bytes, got {len(binary_data)}")

    pixel_count = struct.unpack("H", binary_data[:2])[0]
    canvas = [[(0, 0, 0) for _ in range(64)] for _ in range(64)]

    for i in range(pixel_count):
        offset = 2 + i * 5
        x, y, r, g, b = struct.unpack("BBBBB", binary_data[offset : offset + 5])
        if 0 <= x <= 63 and 0 <= y <= 63:
            canvas[y][x] = (r, g, b)

    return canvas


def get_status() -> dict:
    return {
        "running": state.running,
        "queue_length": len(state.queue),
        "current_index": state.current_index,
        "display_ms": state.display_ms,
        "transition_ms": state.transition_ms,
        "queue": [{"id": image.id, "name": image.name} for image in state.queue],
    }


def add_image(name: str, canvas: list[list[tuple[int, int, int]]]) -> QueueImage:
    image = QueueImage(id=str(uuid.uuid4()), name=name, canvas=canvas)
    state.queue.append(image)
    return image


def remove_image(image_id: str) -> bool:
    original_length = len(state.queue)
    state.queue = [image for image in state.queue if image.id != image_id]

    if not state.queue:
        state.current_index = 0
        return len(state.queue) != original_length

    if state.current_index >= len(state.queue):
        state.current_index = 0

    return len(state.queue) != original_length


async def _broadcast_slideshow_frame(image: QueueImage) -> None:
    from .utils import broadcast_slideshow_frame

    binary_data = encode_slideshow_frame(
        image.canvas, state.transition_ms, state.display_ms
    )
    await broadcast_slideshow_frame(binary_data)
    await asyncio.to_thread(_sync_canvas_with_image, image.canvas)


def _sync_canvas_with_image(canvas: list[list[tuple[int, int, int]]]) -> None:
    from .utils import replace_canvas

    replace_canvas(canvas)


async def _slideshow_loop() -> None:
    while state.running and state.queue:
        image = state.queue[state.current_index]
        await _broadcast_slideshow_frame(image)

        wait_seconds = (state.transition_ms + state.display_ms) / 1000
        await asyncio.sleep(wait_seconds)

        if not state.running or not state.queue:
            break

        state.current_index = (state.current_index + 1) % len(state.queue)

    state.running = False
    state.task = None


async def start_slideshow() -> dict:
    if not state.queue:
        return {"started": False, "reason": "Queue is empty"}

    if state.running:
        return {"started": True, "reason": "Already running"}

    state.running = True
    state.task = asyncio.create_task(_slideshow_loop())
    return {"started": True}


async def stop_slideshow() -> dict:
    state.running = False
    if state.task:
        state.task.cancel()
        try:
            await state.task
        except asyncio.CancelledError:
            pass
        state.task = None
    return {"stopped": True}


def update_config(display_ms: int | None = None, transition_ms: int | None = None) -> None:
    if display_ms is not None:
        state.display_ms = max(1000, display_ms)
    if transition_ms is not None:
        state.transition_ms = max(500, transition_ms)
