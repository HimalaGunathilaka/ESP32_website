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
// Pins
// -------------------------
#define BUTTON_PIN 18
#define LED_INDICATOR 19
#define ONBOARD_LED 2

// -------------------------
// Global State
// -------------------------
volatile bool buttonPressed = false;
bool focusMode = false; // ✅ single source of truth
int activateCount = 0;

// -------------------------
// ISR
// -------------------------
void IRAM_ATTR handleButtonInterrupt()
{
  buttonPressed = true;
}

// -------------------------
// Apply focus state to hardware
// -------------------------
void applyFocusState()
{
  if (focusMode)
  {
    digitalWrite(LED_INDICATOR, HIGH);

    activateCount++;
    setDisplayNumber(activateCount);

    int row = (activateCount - 1) % 8;
    
    if(row == 1) clearLED();
    setRow(row, CRGB::Red);

    Serial.println("FOCUS MODE ON");
  }
  else
  {
    digitalWrite(LED_INDICATOR, LOW);
    Serial.println("FOCUS MODE OFF");
  }
}

// -------------------------
// Setup
// -------------------------
void setup()
{
  Serial.begin(115200);

  wifiInitialize();

  server.listen(81);
  Serial.println("WebSocket server started at ws://" +
                 WiFi.localIP().toString() + ":81");

  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED_INDICATOR, OUTPUT);
  pinMode(ONBOARD_LED, OUTPUT);

  attachInterrupt(digitalPinToInterrupt(BUTTON_PIN),
                  handleButtonInterrupt,
                  RISING);

  displayInit();
  setDisplayNumber(0);

  initLED();

  Serial.println("Waiting for WebSocket clients...");
}

// -------------------------
// Accept WebSocket client
// -------------------------
void acceptClient()
{
  if (server.poll() && !activeClient)
  {
    activeClient = new WebsocketsClient(server.accept());

    activeClient->onMessage([](WebsocketsMessage message)
                            {
      String msg = message.data();
      Serial.println("Received: " + msg);

      if (msg == "activate") {
        if (!focusMode) {
          focusMode = true;
          applyFocusState();
        }
      }
      else if (msg == "deactivate") {
        if (focusMode) {
          focusMode = false;
          applyFocusState();
        }
      } });

    activeClient->onEvent([](WebsocketsEvent event, String data)
                          {
      if (event == WebsocketsEvent::ConnectionClosed) {
        Serial.println("Client disconnected (event)");
      } });

    digitalWrite(ONBOARD_LED, HIGH);
    Serial.println("Client connected!");
  }
}

// -------------------------
// Button handling
// -------------------------
void handleButton()
{
  if (!buttonPressed || !activeClient)
    return;

  focusMode = !focusMode;

  if (focusMode)
    activeClient->send("ACTIVATE_FOCUS");
  else
    activeClient->send("DEACTIVATE_FOCUS");

  applyFocusState();

  buttonPressed = false;

  // Debounce
  detachInterrupt(digitalPinToInterrupt(BUTTON_PIN));
  delay(300);
  attachInterrupt(digitalPinToInterrupt(BUTTON_PIN),
                  handleButtonInterrupt,
                  RISING);
}

// -------------------------
// Loop
// -------------------------
void loop()
{
  if (!wifiReconnect())
  {
    delay(2000);
    return;
  }

  acceptClient();

  if (activeClient)
  {
    activeClient->poll();

    if (!activeClient->available())
    {
      delete activeClient;
      activeClient = nullptr;
      digitalWrite(ONBOARD_LED, LOW);
      Serial.println("Client disconnected!");
    }
  }

  handleButton();

  showLED();
  displayUpdate();

  delay(50);
}
