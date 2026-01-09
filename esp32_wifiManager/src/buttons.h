#ifndef BUTTONS_H
#define BUTTONS_H

#include <Arduino.h>
#include "wifi_server.h"
#include <PubSubClient.h>

// -------------------------
// Pins
// -------------------------
#define BUTTON_MQTT 33
#define BUTTON_FOCUS 18
#define LED_INDICATOR 19
#define ONBOARD_LED 2

// -------------------------
// External Variables
// -------------------------
extern WiFiClient espClient;
extern PubSubClient client;

extern int count;
extern int count_focus;

extern unsigned long lastMQTTAttempt;
extern const unsigned long mqttRetryInterval;

extern bool focusMode;
extern volatile bool buttonMQTTPressed;
extern volatile bool buttonFocusPressed;

extern const char *topic;

// -------------------------
// Function Declarations
// -------------------------
void IRAM_ATTR handleMQTTButtonInterrupt();
void IRAM_ATTR handleFocusButtonInterrupt();

void buttonPress_MQTT();
void buttonPress_focus();

#endif
