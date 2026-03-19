#ifndef BUTTONS_H
#define BUTTONS_H

#include <Arduino.h>
#include "wifi_mgr.h"
#include <PubSubClient.h>
#include <Preferences.h>
#include "buttons.h"

// -------------------------
// Pins
// -------------------------
#define BUTTON_FOCUS 18
#define LED_INDICATOR 19
#define ONBOARD_LED 2

// -------------------------
// External Variables
// -------------------------
extern WiFiClient espClient;
extern PubSubClient client;

extern int sessionCount;
extern Preferences prefs;

extern bool focusMode;
extern volatile bool buttonMQTTPressed;
extern volatile bool buttonFocusPressed;

// -------------------------
// Function Declarations
// -------------------------
void IRAM_ATTR handleFocusButtonInterrupt();

void buttonPress_focus();

#endif
