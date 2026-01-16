#ifndef WIFI_CUSTOM_H
#define WIFI_CUSTOM_H

#include <WiFi.h>
#include <PubSubClient.h>

// Wi-Fi credentials (defined in .cpp)
extern const char *ssid;
extern const char *password;

// MQTT credentials (defined in .cpp)
extern const char *mqtt_username;
extern const char *mqtt_password;
extern const int mqtt_port;
extern const char *topic;

// Functions
void setup_wifi();
void reconnect();

// Global MQTT client
extern WiFiClient espClient;
extern PubSubClient client;

#endif
