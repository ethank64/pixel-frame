const production = false;

export const EC2_IP = production ? "3.21.104.21:8000" : "localhost:8000";

export const WS_URL = `ws://${EC2_IP}/api/ws/canvas`;
export const API_BASE_URL = `http://${EC2_IP}/api`;
export const UPDATE_IMAGE_URL = `http://${EC2_IP}/api/update_image`;
export const RESET_URL = `http://${EC2_IP}/api/reset`;
