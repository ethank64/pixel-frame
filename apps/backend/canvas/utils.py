# apps/backend/canvas/utils.py
import json
import asyncio

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
    update_message = json.dumps({"type": "pixel_update", "x": x, "y": y, "r": r, "g": g, "b": b})
    for client in connected_clients:
        try:
            await client.send_text(update_message)
        except Exception as e:
            print(f"Failed to send to client: {e}")

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