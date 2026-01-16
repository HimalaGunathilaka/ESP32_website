#ifndef BUTTONS_CPP
#define BUTTONS_CPP

#include <Arduino.h>
#include "wifi_mgr.h"
#include <PubSubClient.h>

// -------------------------
// Pins
// -------------------------
#define BUTTON_MQTT 33
#define BUTTON_FOCUS 18
#define LED_INDICATOR 19
#define ONBOARD_LED 2

// --------------------------
// MQTT - WiFi
// --------------------------
WiFiClient espClient;
PubSubClient client(espClient);


// -------------------------
// Global State
// -------------------------
int count = 1;


// ++++++++++++++++++++++++++++++++++++
bool focusMode = false;
// ++++++++++++++++++++++++++++++++++++

const char *topic = "focus/activate";

// -----------------
unsigned long lastButtonTime = 0;
const unsigned long debounceMs = 300;
volatile bool buttonFocusPressed = false;


// -------------------------
// ISR
// -------------------------
void IRAM_ATTR handleFocusButtonInterrupt()
{
  buttonFocusPressed = true;
  detachInterrupt(digitalPinToInterrupt(BUTTON_FOCUS));
}

void buttonPress_focus()
{
  if (!buttonFocusPressed)
    return;

  Serial.println("Focus pressed!");

  unsigned long now = millis();
  if (now - lastButtonTime < debounceMs)
    return;
  lastButtonTime = now;

  if (!client.connected())
    return;

  if (focusMode)
    client.publish(topic, "DEACTIVATE");
  else
    client.publish(topic, "ACTIVATE");

  buttonFocusPressed = false;
  attachInterrupt(digitalPinToInterrupt(BUTTON_FOCUS),
                  handleFocusButtonInterrupt,
                  RISING);
}



#endif