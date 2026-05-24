# apps/backend/canvas/utils.py
import json
import asyncio
import struct

# In-memory canvas state (resets on server restart)
canvas = [[(0, 0, 0) for _ in range(64)] for _ in range(64)]

FULL_IMAGE_SIZE = 2 + 64 * 64 * 5


async def get_canvas():
    """Return the current canvas state."""
    return canvas


def update_pixel(x: int, y: int, r: int, g: int, b: int):
    """Update a single pixel's RGB color in the in-memory canvas."""
    if (
        0 <= x <= 63
        and 0 <= y <= 63
        and 0 <= r <= 255
        and 0 <= g <= 255
        and 0 <= b <= 255
    ):
        canvas[y][x] = (r, g, b)


def _clients_excluding_sender(sender_websocket):
    from .routes import connected_clients

    if sender_websocket is None:
        return list(connected_clients)
    return [client for client in connected_clients if client != sender_websocket]


async def _broadcast_bytes(binary_data: bytes, sender_websocket=None):
    clients = _clients_excluding_sender(sender_websocket)
    if not clients:
        return

    await asyncio.gather(
        *(client.send_bytes(binary_data) for client in clients),
        return_exceptions=True,
    )


async def broadcast_canvas_update(
    x: int, y: int, r: int, g: int, b: int, sender_websocket=None
):
    """Broadcast a single pixel update to all connected clients except the sender."""
    binary_data = struct.pack("BBBBB", x, y, r, g, b)
    await _broadcast_bytes(binary_data, sender_websocket)


async def handle_binary_pixel_batch(binary_data: bytes, sender_websocket):
    """
    Handle batched pixel updates from clients.
    Format: [count][x][y][r][g][b] for each pixel.
    """
    try:
        pixel_count = struct.unpack("H", binary_data[:2])[0]
        expected_size = 2 + pixel_count * 5
        if len(binary_data) != expected_size:
            print(f"Invalid pixel batch size: {len(binary_data)} != {expected_size}")
            return

        for i in range(pixel_count):
            offset = 2 + (i * 5)
            x, y, r, g, b = struct.unpack("BBBBB", binary_data[offset : offset + 5])
            update_pixel(x, y, r, g, b)

        await _broadcast_bytes(binary_data, sender_websocket)
    except Exception as e:
        print(f"Error handling binary pixel batch: {e}")


async def handle_binary_image_update(binary_data: bytes, sender_websocket):
    """
    Handle binary image updates from clients.
    Format: [count][x][y][r][g][b] for each pixel (including black pixels)
    """
    try:
        pixel_count = struct.unpack("H", binary_data[:2])[0]
        print(f"Received binary image update with {pixel_count} pixels")

        broadcast_task = asyncio.create_task(
            broadcast_image_update(binary_data, sender_websocket)
        )
        await update_canvas_bulk(binary_data, pixel_count)
        await broadcast_task
        print("Finished processing image update")
    except Exception as e:
        print(f"Error handling binary image update: {e}")


async def broadcast_image_update(binary_data: bytes, sender_websocket):
    """Broadcast a full image update to all connected clients except the sender."""
    await _broadcast_bytes(binary_data, sender_websocket)


async def update_canvas_bulk(binary_data: bytes, pixel_count: int):
    """Update the canvas with all pixels from binary data."""
    global canvas

    new_canvas = [[(0, 0, 0) for _ in range(64)] for _ in range(64)]

    for i in range(pixel_count):
        offset = 2 + (i * 5)
        x, y, r, g, b = struct.unpack("BBBBB", binary_data[offset : offset + 5])
        if (
            0 <= x <= 63
            and 0 <= y <= 63
            and 0 <= r <= 255
            and 0 <= g <= 255
            and 0 <= b <= 255
        ):
            new_canvas[y][x] = (r, g, b)

    canvas = new_canvas


async def reset_canvas():
    global canvas
    canvas = [[(0, 0, 0) for _ in range(64)] for _ in range(64)]


async def broadcast_reset():
    """Broadcast a reset message to all connected WebSocket clients."""
    from .routes import connected_clients

    reset_message = json.dumps({"type": "reset"})
    await asyncio.gather(
        *(client.send_text(reset_message) for client in connected_clients),
        return_exceptions=True,
    )
