#ifndef MQTT_H
#define MQTT_H

#include <Arduino.h>
#include <PubSubClient.h>

// -------------------------
// MQTT Configuration (extern)
// -------------------------
extern String mqttBroker;
extern int mqttPort;
extern String mqttUsername;
extern String mqttPassword;

extern unsigned long lastMQTTAttempt;
extern const unsigned long mqttRetryInterval;
extern unsigned long lastSession;

// -------------------------
// Function Declarations
// -------------------------
void callback(char *topic, byte *payload, unsigned int length);
void attemptMQTT();
void tryReconnecting_MQTT();
void applyFocusState();
void handleFocusEnd(char *payload);



#endif
