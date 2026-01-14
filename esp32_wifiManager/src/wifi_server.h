#ifndef WIFI_SERVER_H
#define WIFI_SERVER_H

#include <WiFiManager.h>
#include <WebServer.h>

extern WiFiManager wm;
extern WebServer server;

extern String mqttBroker;
extern String mqttUsername;
extern String mqttPassword;
extern int mqttPort;

extern bool MQTT_DETAILS_PRESENT;

extern volatile bool buttonMQTTPressed;


String createHTML();

void handleSubmit();
void handle_onConnect();
void handle_NotFound();

void initialize_server();
void initialize_pref();
void saveMQTT();

#endif