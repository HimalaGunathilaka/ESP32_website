#include <WiFiManager.h>
#include <WebServer.h>
#include <Preferences.h>

// For broker link
#define BROKER 64

// For username
#define USER 64

// For password
#define PASS 64

WiFiManager wm;

Preferences prefs;

String mqttBroker = "192.168.1.13";
String mqttUsername = "himala";
String mqttPassword = "123";

int mqttPort = 1883;
