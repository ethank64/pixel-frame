const production = true;

export const PRODUCTION_WS_DOMAIN = "ws.pixel-frame.online";
export const PRODUCTION_API_DOMAIN = "pixel-frame.online";

export const DEV_BACKEND_IP_PORT = "localhost:8000";

const CURRENT_WS_DOMAIN = production ? PRODUCTION_WS_DOMAIN : DEV_BACKEND_IP_PORT;
const CURRENT_API_DOMAIN = production ? PRODUCTION_API_DOMAIN : DEV_BACKEND_IP_PORT;

export const WS_URL = production ? `wss://${CURRENT_WS_DOMAIN}/api/ws/canvas` : `ws://${CURRENT_WS_DOMAIN}/api/ws/canvas`;

export const API_BASE_URL = production ? `https://${CURRENT_API_DOMAIN}/api` : `http://${CURRENT_API_DOMAIN}/api`;

export const UPDATE_IMAGE_URL = `${API_BASE_URL}/update_image`;
export const RESET_URL = `${API_BASE_URL}/reset`;