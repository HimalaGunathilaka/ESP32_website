#include <Arduino.h>
#include <WiFi.h>
#include <ArduinoWebsockets.h>
#include "wifi_manager.h"
#include "display.h"
#include "led.h"

using namespace websockets;

// -------------------------
// WebSocket Server
// -------------------------
WebsocketsServer server;
WebsocketsClient *activeClient = nullptr;

// -------------------------
// Button Configuration
// -------------------------
#define BUTTON_PIN  18
#define LED_INDICATOR 19
volatile bool buttonPressed = false;
int count = 0;


void IRAM_ATTR handleButtonInterrupt()
{
  buttonPressed = true;
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
  pinMode(LED_INDICATOR, OUTPUT);
  pinMode(2, OUTPUT); // Optional: onboard LED for indication
  attachInterrupt(digitalPinToInterrupt(BUTTON_PIN), handleButtonInterrupt, RISING);

  // Display initialization
  displayInit();
  setDisplayNumber(0);

  // Init LED grid
  initLED();
}

// -------------------------
// Loop Function
// -------------------------
void loop()
{
  // Reconnect to Wi-Fi if disconnected
  if (!wifiReconnect())
  {
    delay(2000); // Wait before next attempt
    return;
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
      count++;
      
      if (count % 2 == 0)
      {
        activeClient->send("ACTIVATE_FOCUS");
        Serial.println("ACTIVATE!");
        digitalWrite(LED_INDICATOR, HIGH);

        int activate_count = count / 2;
        // Display number of times focus was activated.
        setDisplayNumber(activate_count);
        displayUpdate();

        // Led display
        clearLED();
        int tmp = activate_count % 8 - 1;
        if (tmp < 0) tmp = 0;

        setRow(tmp, CRGB::Red);
      }
      else
      {
        activeClient->send("DEACTIVATE_FOCUS");
        Serial.println("DEACTIVATE!");
        digitalWrite(LED_INDICATOR, LOW);
      }
    }

    // Reset button state
    buttonPressed = false;

    // Optional: simple debounce
    detachInterrupt(digitalPinToInterrupt(BUTTON_PIN));
    delay(500);
    attachInterrupt(digitalPinToInterrupt(BUTTON_PIN), handleButtonInterrupt, RISING);
  }

  showLED();
  displayUpdate();
  delay(50); // main loop delay
}
