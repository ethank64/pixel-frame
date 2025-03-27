# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from canvas.routes import router  # Import the canvas router

app = FastAPI()

# Allow frontend to talk to backend during dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the canvas routes with a prefix
app.include_router(router, prefix="/api")

@app.get("/")
def read_root():
    return {"message": "Backend is working!"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)