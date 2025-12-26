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
#define BUTTON_PIN     18
#define LED_INDICATOR  19
#define ONBOARD_LED    2

// ------------------------------
// Button debounce
// -----------------------------
unsigned long lastButtonTime = 0;
const unsigned long debounceMs = 300;

// -------------------------
// Global State
// -------------------------
volatile bool buttonPressed = false;
bool focusMode = false;     // single source of truth
int count = 0;

// -------------------------
// ISR
// -------------------------
void IRAM_ATTR handleButtonInterrupt()
{
  buttonPressed = true;
  detachInterrupt(digitalPinToInterrupt(BUTTON_PIN));
}

// -------------------------
// Apply focus state to hardware
// -------------------------
void applyFocusState()
{
  if (focusMode)
  {
    digitalWrite(LED_INDICATOR, HIGH);

    int row = (count - 1) % 9;
    setDisplayNumber(count);

    if (row == 8)
      clearLED();
    else
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
// Accept WebSocket client
// -------------------------
void acceptClient()
{
  if (!server.poll()) return;

  // Close existing client if any
  if (activeClient)
  {
    activeClient->close();
    delete activeClient;
    activeClient = nullptr;
  }

  activeClient = new WebsocketsClient(server.accept());

  activeClient->onMessage([](WebsocketsMessage message)
  {
    String msg = message.data();
    Serial.println("Received: " + msg);

    if (msg == "activate")
    {
      if (!focusMode) count++;
      focusMode = true;
      applyFocusState();
    }
    else if (msg == "deactivate")
    {
      focusMode = false;
      applyFocusState();
    }
    else if (msg == "ping"){
      activeClient->send("pong");
    }
  });

  activeClient->onEvent([](WebsocketsEvent event, String data)
  {
    if (event == WebsocketsEvent::ConnectionClosed)
    {
      Serial.println("Client disconnected!");
      digitalWrite(ONBOARD_LED, LOW);

      delete activeClient;
      activeClient = nullptr;
    }
  });

  digitalWrite(ONBOARD_LED, HIGH);
  Serial.println("Client connected!");
}

// -------------------------
// Button handling
// -------------------------
void handleButton()
{
  if (!buttonPressed || !activeClient) return;

  unsigned long now = millis();
  if (now - lastButtonTime < debounceMs) return;
  lastButtonTime = now;

  if (focusMode)
    activeClient->send("DEACTIVATE_FOCUS");
  else
    activeClient->send("ACTIVATE_FOCUS");

  buttonPressed = false;
  attachInterrupt(digitalPinToInterrupt(BUTTON_PIN),
                  handleButtonInterrupt,
                  RISING);
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
// Loop
// -------------------------
void loop()
{
  if (!WiFi.isConnected())
  {
    digitalWrite(ONBOARD_LED, LOW);
    return;
  }

  acceptClient();

  if (activeClient)
    activeClient->poll();

  handleButton();

  showLED();
  displayUpdate();
}
