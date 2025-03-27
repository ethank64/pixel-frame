# apps/backend/canvas/routes.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
import json
import logging
import asyncio

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()
connected_clients = set()

@router.websocket("/ws/canvas")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.add(websocket)
    try:
        from .utils import get_canvas
        canvas = await get_canvas()
        # Send only non-black pixels to reduce payload size
        initial_data = [{"x": x, "y": y, "r": r, "g": g, "b": b}
                        for y in range(64) for x in range(64)
                        for r, g, b in [canvas[y][x]] if r != 0 or g != 0 or b != 0]
        logger.info(f"Sending init message with {len(initial_data)} pixels")
        await websocket.send_text(json.dumps({"type": "init", "canvas": initial_data}))
        await asyncio.sleep(1.0)  # Delay for ESP32

        while True:
            data = await websocket.receive_text()
            pixel_data = json.loads(data)
            if pixel_data.get("type") == "pixel_update":
                x = pixel_data["x"]
                y = pixel_data["y"]
                r = pixel_data["r"]
                g = pixel_data["g"]
                b = pixel_data["b"]
                from .utils import update_pixel, broadcast_canvas_update
                update_pixel(x, y, r, g, b)
                await broadcast_canvas_update(x, y, r, g, b)

    except WebSocketDisconnect:
        connected_clients.remove(websocket)
        logger.info("Client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        if websocket in connected_clients:
            connected_clients.remove(websocket)

@router.post("/reset")
async def reset_canvas():
    from .utils import reset_canvas, broadcast_reset
    await reset_canvas()
    await broadcast_reset()
    return JSONResponse(content={"message": "Canvas reset successfully"})

@router.post("/update_image")
async def update_image(data: dict):
    pixels = data.get("pixels", [])
    if not pixels:
        return JSONResponse(content={"message": "No pixel data provided"}, status_code=400)

    from .utils import reset_canvas, broadcast_reset, update_pixel, broadcast_canvas_update
    # Reset canvas to black first
    await reset_canvas()
    await broadcast_reset()

    # Update with new pixel data
    for pixel in pixels:
        x = pixel.get("x")
        y = pixel.get("y")
        r = pixel.get("r")
        g = pixel.get("g")
        b = pixel.get("b")
        if (0 <= x <= 63 and 0 <= y <= 63 and 
            0 <= r <= 255 and 0 <= g <= 255 and 0 <= b <= 255):
            update_pixel(x, y, r, g, b)
            await broadcast_canvas_update(x, y, r, g, b)

    return JSONResponse(content={"message": "Image updated successfully"})