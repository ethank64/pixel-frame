const isProd = import.meta.env.PROD;

export const PRODUCTION_WS_DOMAIN = "ws.pixel-frame.online";
export const PRODUCTION_API_DOMAIN = "pixel-frame.online";

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

export const WS_URL = isProd
  ? `wss://${PRODUCTION_WS_DOMAIN}/api/ws/canvas`
  : `${toWsOrigin(devOriginValue)}/api/ws/canvas`;

export const API_BASE_URL = isProd
  ? `https://${PRODUCTION_API_DOMAIN}/api`
  : `${devOriginValue}/api`;

export const UPDATE_IMAGE_URL = `${API_BASE_URL}/update_image`;
export const RESET_URL = `${API_BASE_URL}/reset`;
