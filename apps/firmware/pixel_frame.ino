/* ----------------------------------------------------------------------
Sketch to connect a 64x64 RGB matrix to a WebSocket server and display pixel updates.
Designed for MatrixPortal ESP32-S3.
------------------------------------------------------------------------- */

#include <Adafruit_Protomatter.h>
#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>

/* ----------------------------------------------------------------------
Pin configuration for MatrixPortal ESP32-S3 - 64x64 matrix with 5 address pins
------------------------------------------------------------------------- */
#define HEIGHT  64
#define WIDTH   64

uint8_t rgbPins[]  = {42, 41, 40, 38, 39, 37};
uint8_t addrPins[] = {45, 36, 48, 35, 21};
uint8_t clockPin   = 2;
uint8_t latchPin   = 47;
uint8_t oePin      = 14;

#define NUM_ADDR_PINS 5

Adafruit_Protomatter matrix(
  WIDTH, 4, 1, rgbPins, NUM_ADDR_PINS, addrPins,
  clockPin, latchPin, oePin, true);

// Wi-Fi and WebSocket configuration
const char* ssid = "eduroam";
const char* wifi_username = "ek792523@ohio.edu";
const char* wifi_password = "Hotdog8864*";
const char* ws_host = "44.201.202.86";
const uint16_t ws_port = 8000;
const char* ws_path = "/api/ws/canvas";

WebSocketsClient webSocket;

// SETUP - RUNS ONCE AT PROGRAM START --------------------------------------
void err(int x) {
  uint8_t i;
  pinMode(LED_BUILTIN, OUTPUT);
  for(i=1;;i++) {
    digitalWrite(LED_BUILTIN, i & 1);
    delay(x);
  }
}

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.println("[WebSocket] Disconnected");
      if (length > 0) {
        Serial.printf("Disconnect reason: %s\n", payload);
      }
      break;
    case WStype_CONNECTED:
      Serial.println("[WebSocket] Connected to server");
      matrix.drawPixel(0, 0, matrix.color565(0, 255, 0)); // Green dot
      matrix.show();
      break;
    case WStype_TEXT: {
      Serial.printf("Received message, length: %d bytes\n", length);
      DynamicJsonDocument doc(16384);
      DeserializationError error = deserializeJson(doc, payload);
      if (error) {
        Serial.print("JSON parse failed: ");
        Serial.println(error.c_str());
        return;
      }

      const char* msg_type = doc["type"];
      if (strcmp(msg_type, "init") == 0) {
        JsonArray canvas = doc["canvas"];
        Serial.printf("Received initial canvas with %d pixels\n", canvas.size());
        matrix.fillScreen(0);
        for (JsonObject pixel : canvas) {
          int x = pixel["x"];
          int y = pixel["y"];
          uint8_t r = pixel["r"];
          uint8_t g = pixel["g"];
          uint8_t b = pixel["b"];
          uint16_t color = matrix.color565(r, g, b);
          matrix.drawPixel(x, y, color);
          Serial.printf("Drawing pixel: x=%d, y=%d, r=%d, g=%d, b=%d\n", x, y, r, g, b);
        }
        matrix.show();
        Serial.println("Matrix updated with initial state");
      } else if (strcmp(msg_type, "pixel_update") == 0) {
        int x = doc["x"];
        int y = doc["y"];
        uint8_t r = doc["r"];
        uint8_t g = doc["g"];
        uint8_t b = doc["b"];
        Serial.printf("Pixel update: x=%d, y=%d, r=%d, g=%d, b=%d\n", x, y, r, g, b);
        uint16_t color = matrix.color565(r, g, b);
        matrix.drawPixel(x, y, color);
        matrix.show();
        Serial.println("Matrix updated with pixel");
      }
      break;
    }
    case WStype_ERROR:
      Serial.println("[WebSocket] Error occurred");
      if (length > 0) {
        Serial.printf("Error details: %s\n", payload);
      }
      break;
    case WStype_PING:
      Serial.println("[WebSocket] Ping received");
      break;
    case WStype_PONG:
      Serial.println("[WebSocket] Pong sent");
      break;
  }
}

void setup(void) {
  Serial.begin(115200);

  // Initialize matrix
  ProtomatterStatus status = matrix.begin();
  Serial.printf("Protomatter begin() status: %d\n", status);
  if(status != PROTOMATTER_OK) {
    err(1000);
  }

  // Test matrix
  Serial.println("Testing matrix...");
  matrix.fillScreen(matrix.color565(255, 0, 0)); // Red screen
  matrix.show();
  delay(2000);
  matrix.fillScreen(0);
  matrix.show();

  // Connect to eduroam
  Serial.print("Connecting to Wi-Fi: ");
  Serial.println(ssid);
  WiFi.begin(ssid, WPA2_AUTH_PEAP, wifi_username, wifi_username, wifi_password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    if (WiFi.status() == WL_NO_SSID_AVAIL) {
      Serial.println("SSID not found");
      err(500);
    } else if (WiFi.status() == WL_CONNECT_FAILED) {
      Serial.println("Connection failed (check credentials)");
      err(500);
    }
  }
  Serial.println("\nWi-Fi connected");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());

  // Initialize WebSocket
  Serial.println("Attempting WebSocket connection...");
  webSocket.begin(ws_host, ws_port, ws_path);
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(1000); // Retry every 1s
  webSocket.enableHeartbeat(3000, 2000, 2); // Ping every 3s, timeout 2s
  webSocket.setExtraHeaders("User-Agent: ESP32-PixelCanvas");
}

void loop() {
  webSocket.loop();
}