/**
 * @file buttons.cpp
 * @brief Handles button inputs and hardware interrupts for the timer.
 */

#include <Arduino.h>
#include <PubSubClient.h>
#include "mqtt.h"
#include "buttons.h"
#include "wifi_mgr.h"

/// @brief Pin connected to the main focus button
#define BUTTON_FOCUS 18

/// @brief Pin for the indicator LED
#define LED_INDICATOR 19

/// @brief Onboard LED pin
#define ONBOARD_LED 2

// ------------- MQTT - WiFi ---------------
WiFiClient espClient;
PubSubClient client(espClient);

// Count the number of completed sessions
int sessionCount = 0;

/// @brief Current state of the focus mode
bool focusMode = false;


/// @brief Tracks the last time the button was successfully pressed for debouncing
unsigned long lastButtonTime = 0;

/// @brief Minimum time (ms) required between valid button presses
const unsigned long debounceMs = 300;

/// @brief Flag set by the ISR when the button is physically pressed
volatile bool buttonFocusPressed = false;


/**
 * @brief Interrupt Service Routine (ISR) for the focus button.
 */
void IRAM_ATTR handleFocusButtonInterrupt()
{
  buttonFocusPressed = true;
  detachInterrupt(digitalPinToInterrupt(BUTTON_FOCUS));
}

/**
 * @brief Processes the focus button press inside the main loop. 
 */
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

  // Get username from preferences
  String username = prefs.getString("username", "");
  String topic = username + "/focus/activate";

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
