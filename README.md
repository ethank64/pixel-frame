# pixel-frame
A 64x64 LED matrix in a picture frame, controlled via a web interface. Draw with friends in real-time using a WebSocket-powered backend and watch the wall art come to life on a microcontroller-driven display.

# How to run
For backend:
uvicorn main:app --reload --host 0.0.0.0 --port 8000
