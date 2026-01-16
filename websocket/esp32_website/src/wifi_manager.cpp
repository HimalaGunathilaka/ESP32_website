#include "wifi_manager.h"
#include <Arduino.h>

// -------------------------
// Wi-Fi Configuration
// -------------------------
const char *SSID = "Himala-A12";
const char *PASSWORD = "reko2115";


// -------------------------
// Wi-Fi Initialization Function
// -------------------------
void wifiInitialize()
{
  WiFi.begin(SSID, PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED)
  {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected! IP: " + WiFi.localIP().toString());
}

// -------------------------
// Wi-Fi Reconnection Function
// -------------------------
bool wifiReconnect()
{
  if (WiFi.status() != WL_CONNECTED)
  {
    Serial.println("WiFi disconnected! Attempting to reconnect...");
    WiFi.disconnect();
    wifiInitialize();
    if (WiFi.status() != WL_CONNECTED)
    {
      Serial.println("\nFailed to reconnect to WiFi.");
      return false;
    }
    return true;
  }
  return true; // Already connected
}
