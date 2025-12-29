#include "wifi_manager.h"
#include <Arduino.h>

// ----------------------
// Define credentials
// ----------------------
const char *ssid = "Himala-A12";
const char *password = "reko2115";

const char *mqtt_username = "himala";
const char *mqtt_password = "123";
const int mqtt_port = 1883;
const char *topic = "focus/activate";

// ----------------------
// Global MQTT client
// ----------------------
WiFiClient espClient;
PubSubClient client(espClient);

// ----------------------
// Functions
// ----------------------
void setup_wifi() {
    delay(10);
    Serial.println("Connecting to WiFi...");
    WiFi.begin(ssid, password);

    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }

    Serial.println("\nWiFi connected");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
}

void reconnect() {
    while (!client.connected()) {
        Serial.print("Connecting to MQTT...");
        if (client.connect("ESP32Client", mqtt_username, mqtt_password)) {
            Serial.println("connected");
            // Subscribe to topic
            client.subscribe(topic);
        } else {
            Serial.print("failed, rc=");
            Serial.print(client.state());
            Serial.println(" retrying in 2 seconds");
            delay(2000);
        }
    }
}
