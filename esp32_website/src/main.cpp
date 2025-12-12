#include <Arduino.h>
#include <WiFi.h>
#include <ArduinoWebsockets.h>

using namespace websockets;

// -------------------------
// Wi-Fi Configuration
// -------------------------
const char *SSID = "Himala-A12";
const char *PASSWORD = "reko2115";

// -------------------------
// WebSocket Server
// -------------------------
WebsocketsServer server;
WebsocketsClient *activeClient = nullptr;

// -------------------------
// Button Configuration
// -------------------------
const int BUTTON_PIN = 18;
volatile bool buttonPressed = false;
int SWITCH = 0;

void IRAM_ATTR handleButtonInterrupt()
{
  buttonPressed = true;
}

// -------------------------
// Wi-Fi Initialization Function
// -------------------------
void wifiInitialize()
{
  WiFi.begin(SSID, PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED)
  {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected! IP: " + WiFi.localIP().toString());
}

// -------------------------
// Setup Function
// -------------------------
void setup()
{
  // Serial for debugging
  Serial.begin(115200);

  // Connect to Wi-Fi
  wifiInitialize();

  // Start WebSocket server on port 81
  server.listen(81);
  Serial.println("WebSocket server started on ws://" + WiFi.localIP().toString() + ":81");

  // No onEvent method; handle new clients in loop()
  Serial.println("Waiting for WebSocket clients...");

  // Button setup
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(2, OUTPUT); // Optional: onboard LED for indication
  attachInterrupt(digitalPinToInterrupt(BUTTON_PIN), handleButtonInterrupt, RISING);
}

// -------------------------
// Loop Function
// -------------------------
void loop()
{
  // Reconnect to Wi-Fi if disconnected
  if (WiFi.status() != WL_CONNECTED)
  {
    Serial.println("WiFi disconnected! Attempting to reconnect...");
    WiFi.disconnect();
    wifiInitialize();
    if (WiFi.status() != WL_CONNECTED)
    {
      Serial.println("\nFailed to reconnect to WiFi.");
      delay(2000); // Wait before next attempt
      return;
    }
  }

  // Accept new clients
  if (server.poll())
  {
    if (!activeClient)
    {
      activeClient = new WebsocketsClient(server.accept());
      digitalWrite(2, HIGH); // Turn on LED when client connected
      Serial.println("Client connected!");
    }
  }

  // Check if active client is still connected
  if (activeClient && !activeClient->available())
  {
    delete activeClient;
    activeClient = nullptr;
    digitalWrite(2, LOW); // Turn off LED when client disconnected
    Serial.println("Client disconnected!");
  }

  // Check button state
  if (buttonPressed)
  {
    // Serial.println("Button pressed!");

    // Send message to active client if available
    if (activeClient && activeClient->available())
    {
      SWITCH++;
      SWITCH= SWITCH % 2;
      if (SWITCH % 2 == 0)
      {
        activeClient->send("ACTIVATE_FOCUS");
        Serial.println("ACTIVATE!");
      }
      else
      {
        activeClient->send("DEACTIVATE_FOCUS");
        Serial.println("DEACTIVATE!");
      }
    }

    // Reset button state
    buttonPressed = false;

    // Optional: simple debounce
    detachInterrupt(digitalPinToInterrupt(BUTTON_PIN));
    delay(500);
    attachInterrupt(digitalPinToInterrupt(BUTTON_PIN), handleButtonInterrupt, RISING);
  }

  delay(50); // main loop delay
}
