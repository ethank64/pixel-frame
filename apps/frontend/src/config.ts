const isProd = import.meta.env.PROD;

// Cloudflare Tunnel exposes the Lightsail backend over HTTPS/WSS.
const PRODUCTION_API_ORIGIN =
  import.meta.env.VITE_API_ORIGIN ?? "https://pixel-frame-api.ethanknotts.com";

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
const productionApiOrigin = PRODUCTION_API_ORIGIN.replace(/\/$/, "");
const productionWsOrigin = toWsOrigin(productionApiOrigin);

export const WS_URL = isProd
  ? `${productionWsOrigin}/api/ws/canvas`
  : `${toWsOrigin(devOriginValue)}/api/ws/canvas`;

export const API_BASE_URL = isProd
  ? `${productionApiOrigin}/api`
  : `${devOriginValue}/api`;

export const UPDATE_IMAGE_URL = `${API_BASE_URL}/update_image`;
export const RESET_URL = `${API_BASE_URL}/reset`;
