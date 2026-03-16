#ifndef MQTT_CPP
#define MQTT_CPP

#include "mqtt.h"
#include "buttons.h"
#include "led.h"
#include "display.h"

bool sessionComplete = false;

// -------------------------
// MQTT Timing Variables
// -------------------------
unsigned long lastMQTTAttempt = 0;
const unsigned long mqttRetryInterval = 5000;

bool statusSent = false;
bool isMessageSource = false; // Track if we published the last message

// ---------------------------------------------
// MQTT
// ---------------------------------------------
void callback(char *topic, byte *payload, unsigned int length)
{
  String username = prefs.getString("username", "");
  String topic_str = username + "/focus/activate";

  // Make sure payload is null-terminated
  char msg[length + 1];
  memcpy(msg, payload, length);
  msg[length] = '\0';

  Serial.print("Payload: ");
  Serial.println(msg);

  if (strcmp(topic, topic_str.c_str()) != 0)
    return;

  // If this is our own message (echo), ignore it
  if (isMessageSource)
  {
    Serial.println("Ignoring own message");
    isMessageSource = false;
    return;
  }

  // Extract the rest to an int variable
  int value = 0;

  if (strncmp(msg, "a|", 2) == 0)
  {
    if (!focusMode)
    {
      focusMode = true;
    }

    if (strlen(msg) > 2)
    {
      value = atoi(msg + 2);
    }

    applyFocusState();
  }
  else if (strncmp(msg, "d|c", 3) == 0)
  {
    if (focusMode)
    {
      focusMode = false;
      sessionComplete = true;
      applyFocusState();
    }

    if (strlen(msg) > 4)
    {
      value = atoi(msg + 4);
    }
  }
  else if (strncmp(msg, "d|n", 3) == 0)
  {
    if (focusMode)
    {
      focusMode = false;
      applyFocusState();
    }

    if (strlen(msg) > 4)
    {
      value = atoi(msg + 4);
      handleFocusEnd(value);
    }
    else
    {
      handleFocusEnd(sessionCount);
    }
  }

  if (value > sessionCount)
  {
    sessionCount = value;
  }
}

// Reconnecting mqtt
void attemptMQTT()
{

  Serial.print("Attempting MQTT connection... ");

  client.setServer(mqttBroker.c_str(), mqttPort);
  client.setCallback(callback);

  // ------------------------
  // Connect with Last Will & Testament
  // ------------------------
  // Parameters: clientId, username, password, willTopic, willQos, willRetain, willMessage
  if (client.connect("ESP32Client",
                     mqttUsername.c_str(),
                     mqttPassword.c_str(),
                     "esp/status",
                     1,
                     true,
                     "offline",
                     false))
  {
    Serial.println("connected");
    String username = prefs.getString("username", "");
    String topic_str = username + "/focus/activate";

    client.subscribe(topic_str.c_str());
    digitalWrite(ONBOARD_LED, HIGH);
  }
  else
  {
    Serial.print("failed, state=");
    Serial.println(client.state());
    digitalWrite(ONBOARD_LED, LOW);
  }
}

void tryReconnecting_MQTT()
{
  if (!client.connected() && count == 1)
  {
    unsigned long now = millis();
    statusSent = false;

    if (now - lastMQTTAttempt > mqttRetryInterval)
    {
      lastMQTTAttempt = now;
      digitalWrite(ONBOARD_LED, LOW);
      attemptMQTT();
    }
  }
  else if (!statusSent)
  {
    client.publish("esp/status", "online");
    statusSent = true;
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

    // int row = (count_focus - 1) % 9;

    // if (row == 8)
    //   clearLED();
    // else
    //   setRow(row, CRGB::Red);

    Serial.println("Focus MODE ON");
  }
  else
  {
    digitalWrite(LED_INDICATOR, LOW);
    Serial.println("Focus MODE OFF");
  }
}

void handleFocusEnd(int payload)
{
  int sessionTime = SESSION_TIME * payload;

  setDisplayNumber(sessionTime);
  Serial.print("Diplay time");
  Serial.println(sessionTime);
}

#endif