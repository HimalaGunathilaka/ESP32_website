#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include <WiFi.h>

// -------------------------
// Wi-Fi Configuration
// -------------------------
extern const char *SSID;
extern const char *PASSWORD;

// -------------------------
// Wi-Fi Functions
// -------------------------
void wifiInitialize();
bool wifiReconnect();

#endif
