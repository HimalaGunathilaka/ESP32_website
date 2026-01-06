#include <Arduino.h>
#include "wifi_server.h"
#include <PubSubClient.h>

// -------------------------
// Pins
// -------------------------
#define BUTTON_PIN 18
#define LED_INDICATOR 19
#define ONBOARD_LED 2

// --------------------------
// MQTT - WiFi
// --------------------------
WiFiClient espClient;
PubSubClient client(espClient);

const char *topic = "focus/activate";
// const char *mqttUsername = "your_username";  // Replace with your MQTT username
// const char *mqttPassword = "your_password";  // Replace with your MQTT password

// -------------------------
// Global State
// -------------------------
int count = 0;
unsigned long lastMQTTAttempt = 0;
const unsigned long mqttRetryInterval = 5000;

// -------------------------
// ISR
// -------------------------
void IRAM_ATTR handleButtonInterrupt()
{
  buttonPressed = true;
  detachInterrupt(digitalPinToInterrupt(BUTTON_PIN));
}

void callback(char *topic, byte *payload, unsigned int length)
{
  // Make sure payload is null-terminated
  char msg[length + 1];
  memcpy(msg, payload, length);
  msg[length] = '\0';

  Serial.print("Payload: ");
  Serial.println(msg);
}

// Reconnecting mqtt
void attemptMQTT()
{

  Serial.print("Attempting MQTT connection... ");

  client.setServer(mqttBroker.c_str(), mqttPort);
  client.setCallback(callback);

  if (client.connect("ESP32Client",
                     mqttUsername.c_str(),
                     mqttPassword.c_str()))
  {
    Serial.println("connected");
    client.subscribe(topic);
    digitalWrite(LED_BUILTIN, HIGH);
  }
  else
  {
    Serial.print("failed, state=");
    Serial.println(client.state());
    digitalWrite(LED_BUILTIN, LOW);
  }
}


void setup()
{
  Serial.begin(115200);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(BUTTON_PIN),
                  handleButtonInterrupt,
                  RISING);
  initialize_server();
}

void loop()
{
  if (WiFi.status() != WL_CONNECTED)
  {
    wm.autoConnect("ESP32-WiFi", "password");
    return;
    // If goes to return below will not be achieved.
  }

  if (!client.connected() && count == 1)
  {
    unsigned long now = millis();

    if (now - lastMQTTAttempt > mqttRetryInterval)
    {
      lastMQTTAttempt = now;
      digitalWrite(LED_BUILTIN, LOW);
      attemptMQTT();
    }
  }

  if (client.connected()){
    client.loop();
  }

  digitalWrite(LED_BUILTIN, HIGH);

  if (buttonPressed)
  {
    count = (count + 1) % 2;
    buttonPressed = false;
    delay(300);
    attachInterrupt(digitalPinToInterrupt(BUTTON_PIN), handleButtonInterrupt, RISING);
    Serial.println("Button pressed!!");
    // Serial.println(0.count);
  }
  if (count == 0)
    server.handleClient();
}