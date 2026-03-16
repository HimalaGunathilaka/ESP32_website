#ifndef MQTT_H
#define MQTT_H

#include <Arduino.h>
#include <PubSubClient.h>
#include <Preferences.h>


// -------------------------
// MQTT Configuration (extern)
// -------------------------
extern Preferences prefs;
extern String mqttBroker;
extern int mqttPort;
extern String mqttUsername;
extern String mqttPassword;

extern bool sessionComplete;
extern bool isMessageSource;

// Time for a complete session
#define SESSION_TIME 2

// -------------------------
// Function Declarations
// -------------------------
void callback(char *topic, byte *payload, unsigned int length);
void attemptMQTT();
void tryReconnecting_MQTT();
void applyFocusState();
void handleFocusEnd(int payload);

#endif
