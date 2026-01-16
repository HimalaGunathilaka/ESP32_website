#ifndef BUTTONS_H
#define BUTTONS_H

#include <Arduino.h>
#include "wifi_mgr.h"
#include <PubSubClient.h>

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

extern int count;

extern bool focusMode;
extern volatile bool buttonMQTTPressed;
extern volatile bool buttonFocusPressed;

extern const char *topic;

// -------------------------
// Function Declarations
// -------------------------
void IRAM_ATTR handleFocusButtonInterrupt();

void buttonPress_focus();

#endif
