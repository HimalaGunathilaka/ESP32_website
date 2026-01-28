#ifndef WIFI_MGR_H
#define WIFI_MGR_H

#include <WiFiManager.h>
#include <WebServer.h>
// #include <ESPAsyncWebServer.h>

// extern AsyncWebServer server;

extern WiFiManager wm;

extern String mqttBroker;
extern String mqttUsername;
extern String mqttPassword;
extern int mqttPort;

#endif