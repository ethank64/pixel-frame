# apps/backend/canvas/routes.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
import json
import logging
import asyncio
import struct

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()
connected_clients = set()

@router.websocket("/ws/canvas")
async def websocket_endpoint(websocket: WebSocket):
    """
    Entry point for all websocket connections.
    Accepts connections, sends initial data, and handles updates.
    Possible messages:
    - text: JSON object with type and data
    - bytes: binary data
    """
    # Accept all connections
    await websocket.accept()

    # Update the list of all connected clients
    connected_clients.add(websocket)

    try:
        from .utils import get_canvas
        canvas = await get_canvas()

        # Create binary data for non-black pixels
        # Format: [count][x][y][r][g][b] for each non-black pixel
        binary_data = bytearray()
        pixel_count = 0
        
        for y in range(64):
            for x in range(64):
                r, g, b = canvas[y][x]

                # Excludes black pixels
                if r != 0 or g != 0 or b != 0:
                    binary_data.extend(struct.pack('BBBBB', x, y, r, g, b))
                    pixel_count += 1
        
        # Prepend the count as a 2-byte integer
        final_data = struct.pack('H', pixel_count) + binary_data
        
        logger.info(f"Sending binary init message with {pixel_count} pixels, size: {len(final_data)} bytes")

        # Send the binary canvas data to the client
        await websocket.send_bytes(final_data)
        await asyncio.sleep(1.0)  # Delay for ESP32

        while True:
            # Receive either text or binary data
            message = await websocket.receive()
            
            # Used for individual pixel updates
            if message["type"] == "websocket.receive":
                # Unshortened bytes (inefficient)
                if "text" in message:
                    # Handle text messages (JSON)
                    data = json.loads(message["text"])
                    
                    # If the client sends a pixel update, update the canvas and broadcast the change
                    if data.get("type") == "pixel_update":
                        x = data["x"]
                        y = data["y"]
                        r = data["r"]
                        g = data["g"]
                        b = data["b"]
                        from .utils import update_pixel, broadcast_canvas_update
                        update_pixel(x, y, r, g, b)

                        # Send updated canvas data to all connected clients
                        await broadcast_canvas_update(x, y, r, g, b)
                
                # Used for both individual pixel updates and full image updates
                elif "bytes" in message:
                    # Handle binary messages (image updates)
                    binary_data = message["bytes"]
                    
                    if len(binary_data) == 5:
                        # Single pixel update
                        x, y, r, g, b = struct.unpack('BBBBB', binary_data)
                        from .utils import update_pixel, broadcast_canvas_update
                        update_pixel(x, y, r, g, b)
                        await broadcast_canvas_update(x, y, r, g, b)
                    
                    elif len(binary_data) > 5:
                        # Full image update
                        await handle_binary_image_update(binary_data, websocket)

    except WebSocketDisconnect:
        connected_clients.remove(websocket)
        logger.info(f"Client disconnected. Total clients: {len(connected_clients)}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        if websocket in connected_clients:
            connected_clients.remove(websocket)

async def handle_binary_image_update(binary_data: bytes, sender_websocket):
    """
    Handle binary image updates from clients.
    Format: [count][x][y][r][g][b] for each pixel (including black pixels)
    """
    from .utils import update_canvas_bulk, broadcast_image_update
    
    try:
        # First 2 bytes are the pixel count
        pixel_count = struct.unpack('H', binary_data[:2])[0]
        logger.info(f"Received binary image update with {pixel_count} pixels")
        
        # Broadcast immediately to reduce latency
        logger.info(f"Broadcasting image update immediately")
        broadcast_task = asyncio.create_task(broadcast_image_update(binary_data, sender_websocket))
        
        # Update the canvas with all pixels (in parallel with broadcast)
        logger.info(f"Updating canvas with {pixel_count} pixels")
        await update_canvas_bulk(binary_data, pixel_count)
        
        # Wait for broadcast to complete
        await broadcast_task
        logger.info(f"Finished processing image update")
        
    except Exception as e:
        logger.error(f"Error handling binary image update: {e}")

@router.post("/reset")
async def reset_canvas():
    from .utils import reset_canvas, broadcast_reset
    await reset_canvas()
    await broadcast_reset()
    return JSONResponse(content={"message": "Canvas reset successfully"})

@router.post("/update_image")
async def update_image(data: dict):
    """
    Update the canvas with a new canvas image.
    Expects a JSON object with a "pixels" key, which is an array of pixel objects.
    Note: The array is one dimensional
    """
    pixels = data.get("pixels", [])
    if not pixels:
        return JSONResponse(content={"message": "No pixel data provided"}, status_code=400)

    from .utils import update_pixel, broadcast_canvas_update

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



