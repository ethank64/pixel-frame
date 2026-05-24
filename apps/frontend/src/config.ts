const isProd = import.meta.env.PROD;

// Lightsail backend (plain HTTP/WS on port 8000)
const PRODUCTION_BACKEND_HOST = "52.70.238.148";
const PRODUCTION_BACKEND_PORT = 8000;

function devOrigin(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return "http://localhost:5173";
}

function toWsOrigin(httpOrigin: string): string {
  return httpOrigin.replace(/^http:\/\//, "ws://").replace(/^https:\/\//, "wss://");
}

const devOriginValue = devOrigin();
const productionApiOrigin = `http://${PRODUCTION_BACKEND_HOST}:${PRODUCTION_BACKEND_PORT}`;
const productionWsOrigin = `ws://${PRODUCTION_BACKEND_HOST}:${PRODUCTION_BACKEND_PORT}`;

export const WS_URL = isProd
  ? `${productionWsOrigin}/api/ws/canvas`
  : `${toWsOrigin(devOriginValue)}/api/ws/canvas`;

export const API_BASE_URL = isProd
  ? `${productionApiOrigin}/api`
  : `${devOriginValue}/api`;

export const UPDATE_IMAGE_URL = `${API_BASE_URL}/update_image`;
export const RESET_URL = `${API_BASE_URL}/reset`;
