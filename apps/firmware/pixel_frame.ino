/* ----------------------------------------------------------------------
Sketch to connect a 64x64 RGB matrix to a WebSocket server and display pixel updates.
Designed for MatrixPortal ESP32-S3.
Make sure to set up a secrets.h file with the correct credentials for your network.
------------------------------------------------------------------------- */

#include <Adafruit_Protomatter.h>
#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <math.h> // Required for pow() function for gamma correction
#include "secrets.h"

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

// I have different networks saved for different locations I'm at
const char* network = "columbus";

// Set later on depending on network
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
 * @brief Displays an error message on the matrix
 */
void err(int x);

/*
 * webSocketEvent
 * @param type
 * @param payload
 * @param length
 * @brief Handles WebSocket events from the EC2
 */
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length);

/*
 * writeText
 * @param message
 * @brief Writes text to the matrix
 */
void writeText(char* message);

/*
 * setupGammaTable
 * @param gammaValue The gamma correction factor (e.g., 2.2).
 * @brief Initializes the gamma correction lookup table.
 */
void setupGammaTable(float gammaValue);

/*
 * getGammaCorrectedColor
 * @param r Red component (0-255).
 * @param g Green component (0-255).
 * @param b Blue component (0-255).
 * @brief Applies gamma correction to RGB values and returns a 16-bit color.
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

  // Initialize WebSocket with more conservative settings
  Serial.println("Attempting WebSocket connection...");
  webSocket.begin(ws_host, ws_port, ws_path);
  webSocket.onEvent(webSocketEvent);

  Serial.print("Maximum websocket input size: ");
  Serial.println(WEBSOCKETS_MAX_DATA_SIZE);

  // More conservative WebSocket settings
  webSocket.setReconnectInterval(5000); // Retry every 5s instead of 1s
  webSocket.enableHeartbeat(10000, 5000, 2); // Ping every 10s, timeout 5s
  webSocket.setExtraHeaders("User-Agent: ESP32-PixelCanvas");
}

void loop() {
  // Debug connection state periodically
  static unsigned long lastDebugTime = 0;
  static bool lastConnectionState = false;
  
  if (millis() - lastDebugTime > 5000) { // Every 5 seconds
    bool currentConnectionState = webSocket.isConnected();
    if (currentConnectionState != lastConnectionState) {
      Serial.printf("Connection state changed: %s -> %s, Free heap: %d bytes\n", 
                    lastConnectionState ? "connected" : "disconnected",
                    currentConnectionState ? "connected" : "disconnected", 
                    ESP.getFreeHeap());
      lastConnectionState = currentConnectionState;
    }
    lastDebugTime = millis();
  }
  
  webSocket.loop();
}

// Function definitions
void connectToWiFi() {
  if (network == "columbus") {
    ssid = COLUMBUS_SSID;
    wifi_password = COLUMBUS_PASSWORD;
  } else if (network == "ou") {
    ssid = OU_SSID;
    wifi_username = OU_USERNAME;
    wifi_password = OU_PASSWORD;
  } else if (network == "home") {
    ssid = HOME_SSID;
    wifi_password = HOME_PASSWORD;
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
      Serial.printf("Free heap: %d bytes\n", ESP.getFreeHeap());

      if (length > 0) {
        Serial.printf("Disconnect reason: %s\n", payload);
      }

      break;
    case WStype_CONNECTED:
      Serial.println("[WebSocket] Connected to server");
      Serial.printf("Free heap: %d bytes\n", ESP.getFreeHeap());
      writeText("");
      break;
    case WStype_TEXT: {
      // Reduced memory allocation - 32KB instead of 160KB
      DynamicJsonDocument doc(32768);
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
        Serial.printf("Free heap before processing: %d bytes\n", ESP.getFreeHeap());
        
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
          
          // Yield every 100 pixels to prevent watchdog issues
          static int pixelCount = 0;
          if (++pixelCount % 100 == 0) {
            yield();
          }
        }
        matrix.show();
        Serial.printf("Free heap after processing: %d bytes\n", ESP.getFreeHeap());
      } else if (strcmp(msg_type, "pixel_update") == 0) {
        int x = doc["x"];
        int y = doc["y"];
        uint8_t r = doc["r"];
        uint8_t g = doc["g"];
        uint8_t b = doc["b"];

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
    case WStype_BIN: {
      Serial.printf("Received binary message, length: %d bytes\n", length);
      Serial.printf("Free heap: %d bytes\n", ESP.getFreeHeap());
      
      // Check if message is too large (safety check)
      if (length > 30000) { // Reduced from 50KB to 30KB
        Serial.printf("Message too large (%d bytes), ignoring\n", length);
        break;
      }
      
      // Debug large messages
      if (length > 1000) {
        Serial.printf("Large message detected! Free heap: %d bytes\n", ESP.getFreeHeap());
      }
      
      if (length == 5) {
        // Single pixel update: 5 bytes for x, y, r, g, b
        uint8_t x = payload[0];
        uint8_t y = payload[1];
        uint8_t r = payload[2];
        uint8_t g = payload[3];
        uint8_t b = payload[4];
        
        Serial.printf("Binary pixel update: x=%d, y=%d, r=%d, g=%d, b=%d\n", x, y, r, g, b);
        uint16_t color = getGammaCorrectedColor(r, g, b);
        matrix.drawPixel(x, y, color);
        matrix.show();
        Serial.println("Matrix updated with binary pixel");
        
      } else if (length == 2 + 64 * 64 * 5) {
        // Full image update: count + all 64x64 pixels (4096 pixels)
        uint16_t pixel_count = (payload[1] << 8) | payload[0]; // Little-endian
        Serial.printf("Binary image update with %d pixels\n", pixel_count);
        Serial.printf("Processing large image, Free heap: %d bytes\n", ESP.getFreeHeap());
        
        matrix.fillScreen(0);
        
        for (uint16_t i = 0; i < pixel_count; i++) {
          uint16_t offset = 2 + (i * 5);
          uint8_t x = payload[offset];
          uint8_t y = payload[offset + 1];
          uint8_t r = payload[offset + 2];
          uint8_t g = payload[offset + 3];
          uint8_t b = payload[offset + 4];
          
          uint16_t color = getGammaCorrectedColor(r, g, b);
          matrix.drawPixel(x, y, color);
          
          // Yield every 50 pixels to prevent getting stuck
          if (i % 50 == 0) {
            yield();
          }
        }
        
        matrix.show();
        Serial.printf("Matrix updated with binary image, Free heap: %d bytes\n", ESP.getFreeHeap());
        Serial.println("Matrix updated with binary image");
        
      } else if (length >= 2) {
        // Initial canvas state or image update: count + non-black pixel data
        uint16_t pixel_count = (payload[1] << 8) | payload[0]; // Little-endian
        Serial.printf("Binary message with %d non-black pixels\n", pixel_count);
        Serial.printf("Processing message, Free heap: %d bytes\n", ESP.getFreeHeap());
        
        matrix.fillScreen(0);
        
        for (uint16_t i = 0; i < pixel_count; i++) {
          uint16_t offset = 2 + (i * 5);
          if (offset + 4 < length) {  // Bounds check
            uint8_t x = payload[offset];
            uint8_t y = payload[offset + 1];
            uint8_t r = payload[offset + 2];
            uint8_t g = payload[offset + 3];
            uint8_t b = payload[offset + 4];
            
            uint16_t color = getGammaCorrectedColor(r, g, b);
            matrix.drawPixel(x, y, color);
          }
          
          // Yield every 25 pixels to prevent getting stuck
          if (i % 25 == 0) {
            yield();
          }
        }
        
        matrix.show();
        Serial.printf("Matrix updated, Free heap: %d bytes\n", ESP.getFreeHeap());
        Serial.println("Matrix updated with binary message");
      } else {
        Serial.printf("Unknown binary message format, length: %d\n", length);
      }
      break;
    }
    case WStype_ERROR:
      Serial.println("[WebSocket] Error occurred");
      Serial.printf("Free heap: %d bytes\n", ESP.getFreeHeap());
      if (length > 0) {
        Serial.printf("Error details: %s\n", payload);
      }
      break;
    case WStype_PING:
      break;
    case WStype_PONG:
      break;
  }
}

void err(int x) {
  uint8_t i;
  pinMode(LED_BUILTIN, OUTPUT);

  for (i=1;;i++) {
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