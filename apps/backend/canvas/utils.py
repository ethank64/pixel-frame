# apps/backend/canvas/utils.py
import json
import asyncio
import struct

# Store the canvas as a 2D array in a local JSON file
canvas = [[(0, 0, 0) for _ in range(64)] for _ in range(64)]  # Default black
FILE_PATH = "canvas_state.json"

def load_canvas():
    """Load the canvas state from the local file, if it exists."""
    global canvas
    try:
        with open(FILE_PATH, 'r') as f:
            loaded = json.load(f)
            if len(loaded) == 64 and all(len(row) == 64 for row in loaded):
                canvas = loaded
    except (FileNotFoundError, json.JSONDecodeError, ValueError):
        pass

def save_canvas():
    """Save the current canvas state to the local file."""
    with open(FILE_PATH, 'w') as f:
        json.dump(canvas, f)

load_canvas()

async def get_canvas():
    """Return the current canvas state."""
    return canvas

def update_pixel(x: int, y: int, r: int, g: int, b: int):
    """Update a single pixel's RGB color in the canvas and save to file."""
    if (0 <= x <= 63 and 0 <= y <= 63 and 
        0 <= r <= 255 and 0 <= g <= 255 and 0 <= b <= 255):
        canvas[y][x] = (r, g, b)
        save_canvas()

async def broadcast_canvas_update(x: int, y: int, r: int, g: int, b: int):
    """Broadcast a pixel update to all connected WebSocket clients."""
    from .routes import connected_clients
    # Send binary data: 5 bytes for x, y, r, g, b
    binary_data = struct.pack('BBBBB', x, y, r, g, b)
    for client in connected_clients:
        try:
            await client.send_bytes(binary_data)
        except Exception as e:
            print(f"Failed to send to client: {e}")

async def broadcast_image_update(binary_data: bytes, sender_websocket):
    """Broadcast a full image update to all connected WebSocket clients except the sender."""
    from .routes import connected_clients
    print(f"Broadcasting image update to {len(connected_clients)} clients")
    
    clients_to_notify = [client for client in connected_clients if client != sender_websocket]
    print(f"Will notify {len(clients_to_notify)} other clients")
    
    if not clients_to_notify:
        print("No other clients to notify")
        return
    
    for client in clients_to_notify:
        try:
            await client.send_bytes(binary_data)
            print(f"Successfully sent image update to client")
        except Exception as e:
            print(f"Failed to send image update to client: {e}")

async def update_canvas_bulk(binary_data: bytes, pixel_count: int):
    """Update the canvas with all pixels from binary data more efficiently."""
    global canvas
    
    # Create a new canvas array
    new_canvas = [[(0, 0, 0) for _ in range(64)] for _ in range(64)]
    
    # Process all pixels at once
    for i in range(pixel_count):
        offset = 2 + (i * 5)
        x, y, r, g, b = struct.unpack('BBBBB', binary_data[offset:offset+5])
        if (0 <= x <= 63 and 0 <= y <= 63 and 
            0 <= r <= 255 and 0 <= g <= 255 and 0 <= b <= 255):
            new_canvas[y][x] = (r, g, b)
    
    # Update the global canvas in one operation
    canvas = new_canvas
    save_canvas()

async def reset_canvas():
    """Reset the canvas to all black."""
    global canvas
    canvas = [[(0, 0, 0) for _ in range(64)] for _ in range(64)]
    save_canvas()

async def broadcast_reset():
    """Broadcast a reset message to all connected WebSocket clients."""
    from .routes import connected_clients
    reset_message = json.dumps({"type": "reset"})
    for client in connected_clients:
        try:
            await client.send_text(reset_message)
        except Exception as e:
            print(f"Failed to send to client: {e}")