const production = false;

// Define your domain for production. This will be proxied by Cloudflare.
// For development, keep localhost:8000 if your backend is local.
export const PRODUCTION_WS_DOMAIN = "ws.pixel-frame.online";
export const PRODUCTION_API_DOMAIN = "pixel-frame.online"; // Or your main domain if API is on the same EC2, e.g., api.pixel-frame.online if you set up another A record for it

// Your local development server's IP/Port for WebSocket and API
export const DEV_BACKEND_IP_PORT = "localhost:8000";

// --- Derived URLs ---

// Determine the base domain for WebSockets
const CURRENT_WS_DOMAIN = production ? PRODUCTION_WS_DOMAIN : DEV_BACKEND_IP_PORT;
// Determine the base domain for HTTP API
const CURRENT_API_DOMAIN = production ? PRODUCTION_API_DOMAIN : DEV_BACKEND_IP_PORT;


// WebSocket URL: MUST be wss:// for production
export const WS_URL = production ? `wss://${CURRENT_WS_DOMAIN}/api/ws/canvas` : `ws://${CURRENT_WS_DOMAIN}/api/ws/canvas`;

// API Base URL: MUST be https:// for production
export const API_BASE_URL = production ? `https://${CURRENT_API_DOMAIN}/api` : `http://${CURRENT_API_DOMAIN}/api`;

// Specific API Endpoints using the base URL
export const UPDATE_IMAGE_URL = `${API_BASE_URL}/update_image`;
export const RESET_URL = `${API_BASE_URL}/reset`;