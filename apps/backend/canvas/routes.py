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
        # Only send non-black pixels to reduce payload size
        initial_data = [{"x": x, "y": y, "r": r, "g": g, "b": b}
                        for y in range(64) for x in range(64)
                        for r, g, b in [canvas[y][x]] if r != 0 or g != 0 or b != 0]
        logger.info(f"Sending init message with {len(initial_data)} pixels")
        await websocket.send_text(json.dumps({"type": "init", "canvas": initial_data}))
        await asyncio.sleep(1.0)  # Delay for ESP32

        sample_updates = [
            {"x": 10, "y": 10, "r": 255, "g": 0, "b": 0},
            {"x": 20, "y": 20, "r": 0, "g": 255, "b": 0},
            {"x": 30, "y": 30, "r": 0, "g": 0, "b": 255},
        ]

        for update in sample_updates:
            from .utils import update_pixel, broadcast_canvas_update
            x, y, r, g, b = update["x"], update["y"], update["r"], update["g"], update["b"]
            update_pixel(x, y, r, g, b)
            await broadcast_canvas_update(x, y, r, g, b)

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