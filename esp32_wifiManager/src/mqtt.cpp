#ifndef MQTT_CPP
#define MQTT_CPP

#include "mqtt.h"
#include "buttons.h"
#include "led.h"
#include "display.h"

// -------------------------
// MQTT Timing Variables
// -------------------------
unsigned long lastMQTTAttempt = 0;
const unsigned long mqttRetryInterval = 5000;

// ---------------------------------------------
// MQTT
// ---------------------------------------------
void callback(char *topic, byte *payload, unsigned int length)
{
  // Make sure payload is null-terminated
  char msg[length + 1];
  memcpy(msg, payload, length);
  msg[length] = '\0';

  Serial.print("Payload: ");
  Serial.println(msg);

  if (strcmp(msg, "activate") == 0)
  {
    if (!focusMode)
      count_focus++;
    focusMode = true;
    applyFocusState();
  }
  else if (strncmp(msg, "d|", 2) == 0)
  {
    focusMode = false;
    handleFocusEnd(msg);
    applyFocusState();
  }
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
    digitalWrite(ONBOARD_LED, HIGH);
  }
  else
  {
    Serial.print("failed, state=");
    Serial.println(client.state());
    digitalWrite(ONBOARD_LED, LOW);
  }
}


void tryReconnecting_MQTT(){
  if (!client.connected() && count == 1)
  {
    unsigned long now = millis();
  
    if (now - lastMQTTAttempt > mqttRetryInterval)
    {
      lastMQTTAttempt = now;
      digitalWrite(ONBOARD_LED, LOW);
      attemptMQTT();
    }
  }
}



// -------------------------------------------
// Functions
// -------------------------------------------
void applyFocusState()
{
  if (focusMode)
  {
    digitalWrite(LED_INDICATOR, HIGH);

    int row = (count_focus - 1) % 9;

    if (row == 8)
      clearLED();
    else
      setRow(row, CRGB::Red);

    Serial.println("Focus MODE ON");
  }
  else
  {
    digitalWrite(LED_INDICATOR, LOW);
    Serial.println("Focus MODE OFF");
  }
}

void handleFocusEnd(char *payload)
{
  if (strlen(payload) > 2)
  {
    char *totalTimeStr = payload + 2;
    long sessionTime = atol(totalTimeStr);

    sessionTime = sessionTime / 60;

    setDisplayNumber(sessionTime);
    Serial.println("Diplay time");
    Serial.println(sessionTime);
    // Serial.println(result);
  }
}



#endif