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
    Entry point for all websocket connections. Establishes a connection with the client.
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
        # Get the canvas data for new clients
        from .utils import get_canvas
        canvas = await get_canvas()

        # Create binary data for pixels
        # We use a bytearray to store the data efficiently. Since each color part (red, green, and blue) is
        # just 0-255, we can use 1 byte per color.
        # Format: [count][x][y][r][g][b] for each non-black pixel
        binary_data = bytearray()
        pixel_count = 0
        
        for y in range(64):
            for x in range(64):
                r, g, b = canvas[y][x]

                # Excludes black pixels
                if r != 0 or g != 0 or b != 0:
                    # Use 5 bytes for each pixel that contains coordinate and color
                    binary_data.extend(struct.pack('BBBBB', x, y, r, g, b))
                    pixel_count += 1
        
        # Prepend the count as a 2-byte integer
        final_data = struct.pack('H', pixel_count) + binary_data
        
        logger.info(f"Sending binary init message with {pixel_count} pixels, size: {len(final_data)} bytes")

        # Send the binary canvas data to the client
        await websocket.send_bytes(final_data)
        await asyncio.sleep(1.0)  # Delay for ESP32

        while True:
            # Receive updates from the client
            message = await websocket.receive()
            
            if message["type"] == "websocket.receive":
                # Unshortened bytes (inefficient, legacy)
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
                    
                    # Since we define one pixel as 5 bytes, we know that if our message is 5 bytes,
                    # we're dealing with just one pixel.
                    if len(binary_data) == 5:
                        # Single pixel update
                        x, y, r, g, b = struct.unpack('BBBBB', binary_data)
                        from .utils import update_pixel, broadcast_canvas_update
                        update_pixel(x, y, r, g, b)
                        await broadcast_canvas_update(x, y, r, g, b)
                    
                    # More than 5 bytes, must be several pixels (image)
                    elif len(binary_data) > 5:
                        # Full image update
                        from .utils import handle_binary_image_update

                        await handle_binary_image_update(binary_data, websocket)

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
    """
    Reset the canvas to all black and broadcasts the updated state to all clients.
    """
    from .utils import reset_canvas, broadcast_reset
    await reset_canvas()
    await broadcast_reset()
    return JSONResponse(content={"message": "Canvas reset successfully"})