#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include "wifi_manager.h"
#include "display.h"
#include "led.h"

// -------------------------
// Pins
// -------------------------
#define BUTTON_PIN 18
#define LED_INDICATOR 19
#define ONBOARD_LED 2

// ------------------------------
// Button debounce
// -----------------------------
unsigned long lastButtonTime = 0;
const unsigned long debounceMs = 300;

// -------------------------
// Global State
// -------------------------
volatile bool buttonPressed = false;
bool focusMode = false; // single source of truth
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
  if (
    
  )
  {
    digitalWrite(LED_INDICATOR, HIGH);

    int row = (count - 1) % 9;
    setDisplayNumber(count);
    Serial.println(count);

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

// ----------------------------
// MQTT broker
// ----------------------------
const char *mqtt_broker = "10.108.150.105"; // Put the ip of the laptop

// Callback function: Called when a message arrives
void callback(char *topic, byte *payload, unsigned int length)
{
  Serial.print("Message received on topic: ");
  Serial.println(topic);
  Serial.print("Message: ");

  // Check if payload is "activate"
  if (length == 8 && strncmp((char *)payload, "activate", length) == 0)
  {
    if (!focusMode)
      count++;
    focusMode = true;
    applyFocusState();
  }
  else if (length == 10 && strncmp((char *)payload, "deactivate", length) == 0)
  {
    focusMode = false;
    applyFocusState();
  }
}

// -------------------------
// Button handling
// -------------------------
void handleButton()
{
  if (!buttonPressed || !client.connected())
    return;
  Serial.println("Button pressed!");

  unsigned long now = millis();
  if (now - lastButtonTime < debounceMs)
    return;
  lastButtonTime = now;

  if (focusMode)
    client.publish(topic,"DEACTIVATE");
  else
    client.publish(topic,"ACTIVATE");

  buttonPressed = false;
  attachInterrupt(digitalPinToInterrupt(BUTTON_PIN),
                  handleButtonInterrupt,
                  RISING);
}

void setup()
{
  Serial.begin(115200);
  setup_wifi();

  client.setServer(mqtt_broker, mqtt_port);
  client.setCallback(callback);

  // Hardware initialization for dispaly focus mode
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED_INDICATOR, OUTPUT);
  pinMode(ONBOARD_LED, OUTPUT);

  attachInterrupt(digitalPinToInterrupt(BUTTON_PIN),
                  handleButtonInterrupt,
                  RISING);

  displayInit();
  setDisplayNumber(0);

  initLED();
}

void loop()
{
  if (!client.connected())
  {
    digitalWrite(LED_BUILTIN, LOW);
    reconnect();
  }
  digitalWrite(LED_BUILTIN, HIGH);

  handleButton();

  client.loop();

  showLED();
  displayUpdate();
}