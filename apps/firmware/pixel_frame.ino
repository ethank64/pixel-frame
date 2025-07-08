/* ----------------------------------------------------------------------
Sketch to connect a 64x64 RGB matrix to a WebSocket server and display pixel updates.
Designed for MatrixPortal ESP32-S3.
------------------------------------------------------------------------- */

#include <Adafruit_Protomatter.h>
#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <math.h> // Required for pow() function for gamma correction


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

// A simple gamma correction lookup table
uint8_t gamma8[256];

// Wi-Fi and WebSocket configuration
const char* network = "columbus";

char* ssid;
char* wifi_username;
char* wifi_password;

// Public IP of my EC2 instance for the backend
const char* ws_host = "3.21.104.21";
const uint16_t ws_port = 8000;
const char* ws_path = "/api/ws/canvas";

WebSocketsClient webSocket;

// Function Headers
/* connectToWifi
 * @brief Connects the board to the local network for Internet access
 */
void connectToWiFi();

/*
 * err
 * @param x 
 * @brief 
 */
void err(int x);

/*
 * webSocketEvent
 * @param type
 * @param payload
 * @param length
 * @brief 
 */
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length);

void writeText(char* message);

/*
 * setupGammaTable
 * @brief Initializes the gamma correction lookup table.
 * @param gammaValue The gamma correction factor (e.g., 2.2).
 */
void setupGammaTable(float gammaValue);

/*
 * getGammaCorrectedColor
 * @brief Applies gamma correction to RGB values and returns a 16-bit color.
 * @param r Red component (0-255).
 * @param g Green component (0-255).
 * @param b Blue component (0-255).
 * @return A 16-bit color value (RGB565) with gamma correction applied.
 */
uint16_t getGammaCorrectedColor(uint8_t r, uint8_t g, uint8_t b);


void setup(void) {
  Serial.begin(9600);

  // Initialize matrix
  ProtomatterStatus status = matrix.begin();
  Serial.printf("Protomatter begin() status: %d\n", status);
  if(status != PROTOMATTER_OK) {
    err(1000);
  }

  // Board at the bottom
  matrix.setRotation(3);

  // Setup gamma correction with a common gamma value like 2.2
  setupGammaTable(2.2); 

  // Test matrix
  writeText("Testing matrix...");
  delay(2000);

  connectToWiFi();

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


// Function definitions
void connectToWiFi() {
  if (network == "columbus") {
    ssid = "SpectrumSetup-7F";
    wifi_password = "cameraladder846";
  } else if (network == "ou") {
    ssid = "eduroam";
    wifi_username = "ek792523@ohio.edu";
    wifi_password = "Hotdog8864*";
  } else if (network == "home") {
    ssid = "WIN_706012";
    wifi_password = "nh2jcpmq4h";
  }

  Serial.print("Connecting to Wi-Fi: ");
  writeText("Connecting to WiFi...");
  Serial.println(ssid);

  if (network == "ou") {
    WiFi.begin(ssid, WPA2_AUTH_PEAP, wifi_username, wifi_username, wifi_password);
  } else if (network == "columbus") {
    WiFi.begin(ssid, wifi_password);
  }
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    if (WiFi.status() == WL_NO_SSID_AVAIL) {
      Serial.println("SSID not found");
      writeText("SSID not found");
      err(500);
    } else if (WiFi.status() == WL_CONNECT_FAILED) {
      Serial.println("Connection failed (check credentials)");
      writeText("Connection Failed");
      err(500);
    }
  }

  Serial.println("\nWi-Fi connected");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());
  writeText("Connected!");
  delay(2000);
  matrix.fillScreen(0);
}

void writeText(char* message) {
  matrix.setFont();
  matrix.setTextColor(matrix.color565(255, 255, 255));    // White text
  matrix.setCursor(0, 0);   // Top left
  matrix.fillScreen(0);
  matrix.print(message);
  matrix.show();
}

// How we detect
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
      writeText("");
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
          // Apply gamma correction here
          uint16_t color = getGammaCorrectedColor(r, g, b); 
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
        // Apply gamma correction here
        uint16_t color = getGammaCorrectedColor(r, g, b);
        matrix.drawPixel(x, y, color);
        matrix.show();
        Serial.println("Matrix updated with pixel");
      } else if (strcmp(msg_type, "reset") == 0) {
        matrix.fillScreen(0);
        matrix.show();
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

void err(int x) {
  uint8_t i;
  pinMode(LED_BUILTIN, OUTPUT);
  for(i=1;;i++) {
    digitalWrite(LED_BUILTIN, i & 1);
    delay(x);
  }
}

void setupGammaTable(float gammaValue) {
  for (int i = 0; i < 256; i++) {
    gamma8[i] = (uint8_t)(pow((float)i / 255.0, gammaValue) * 255.0 + 0.5);
  }
}

uint16_t getGammaCorrectedColor(uint8_t r, uint8_t g, uint8_t b) {
  return matrix.color565(gamma8[r], gamma8[g], gamma8[b]);
}