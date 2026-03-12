#ifndef BUTTONS_CPP
#define BUTTONS_CPP

#include <Arduino.h>
#include "wifi_mgr.h"
#include <PubSubClient.h>

#include "mqtt.h"

// -------------------------
// Pins
// -------------------------
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

// Count the number of completed sessions
int sessionCount = 0;

// ++++++++++++++++++++++++++++++++++++
bool focusMode = false;
// ++++++++++++++++++++++++++++++++++++

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

  unsigned long now = millis();
  if (now - lastButtonTime < debounceMs)
    return;

  Serial.println("Focus pressed!");
  lastButtonTime = now;

  if (!client.connected())
    return;

  Serial.println("Reached here");

  // Get username from preferences
  String username = prefs.getString("username", "");
  String topic = username + "/focus/activate";

  Serial.println(username);

  // Build payload with session count
  char payload[20];
  if (focusMode)
    snprintf(payload, sizeof(payload), "d|n|0", sessionCount);
  else
    snprintf(payload, sizeof(payload), "a|0", sessionCount);

  isMessageSource = true;                       // Mark that we're publishing
  client.publish(topic.c_str(), payload, true); // retained=true

  buttonFocusPressed = false;
  attachInterrupt(digitalPinToInterrupt(BUTTON_FOCUS),
                  handleFocusButtonInterrupt,
                  RISING);
}

#endif