/**
 * @file mqtt.cpp
 * @author Himala Gunathilaka
 * @brief Manages MQTT communication, payload parsing, and state synchronization.
 * @version 0.1
 * @date 2026-03-16
 *
 * @copyright Copyright (c) 2026
 *
 * * @note Expected Payload Protocol:
 * - "a|<value>"   : Activate focus mode (e.g., "a|2")
 * - "d|c|<value>" : Deactivate focus, session complete (e.g., "d|c|3")
 * - "d|n|<value>" : Deactivate focus, session cancelled/interrupted (e.g., "d|n|3")
 */

#include "mqtt.h"
#include "buttons.h"
#include "led.h"
#include "display.h"

// @brief Flage to indicate one session is over
bool sessionComplete = false;

/// @brief Tracks if this specific device published the last message to prevent feedback loops
bool isMessageSource = false;

/// @brief Tracks if the "online" status has been published since the last connection
bool statusSent = false;

// @brief Last mqtt connection attempt
unsigned long lastMQTTAttempt = 0;

// @brief MQTT retry interval
const unsigned long mqttRetryInterval = 5000;

/// @brief Maximum expected size for incoming MQTT payloads
#define MAX_MQTT_PAYLOAD_SIZE 64

/**
 * @brief Callback triggered when a subscribed MQTT message arrives.
 *
 * @param topic Topic the message came from
 * @param payload Message it self
 * @param length length of the message
 */
void callback(char *topic, byte *payload, unsigned int length)
{
  String username = prefs.getString("username", "");
  String topic_str = username + "/focus/activate";

  // If this is our own message (echo), ignore it
  if (isMessageSource)
  {
    Serial.println("Ignoring own message");
    isMessageSource = false;
    return;
  }
  if (strcmp(topic, topic_str.c_str()) != 0)
    return;

  // Safely copy payload to a null-terminated string buffer
  char msg[MAX_MQTT_PAYLOAD_SIZE];
  unsigned int copyLength = (length < MAX_MQTT_PAYLOAD_SIZE - 1) ? length : (MAX_MQTT_PAYLOAD_SIZE - 1);
  memcpy(msg, payload, copyLength);
  msg[length] = '\0';

  Serial.print("Payload: ");
  Serial.println(msg);

  int value = 0;

  // ------- Parse protocol -------

  // Handle "Activate" (Format: "a|<value>")
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
  // Handle "Deactivate Complete" (Format: "d|c|<value>")
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
  // Handle "Deactivate Normal/Cancel" (Format: "d|n|<value>")
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

/**
 * @brief Attempts to establish a connection to the MQTT broker.
 * Sets up the Last Will and Testament (LWT) to notify the system if
 * the device drops offline unexpectedly. Subscribes to the user's topic upon success. */
void attemptMQTT()
{

  Serial.print("Attempting MQTT connection... ");

  client.setServer(mqttBroker.c_str(), mqttPort);
  client.setCallback(callback);

  // Connect with Last Will & Testament (LWT)
  // @note: clientId, username, password, willTopic, willQos, willRetain, willMessage
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

/**
 * @brief Non-blocking check and reconnection routine for MQTT.
 *
 */
void tryReconnecting_MQTT()
{
  if (!client.connected())
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

/**
 * @brief Updates physical hardware indicators based on the current focus mode.
 */
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

/**
 * @brief Handles logic to be executed when a focus session ends prematurely or between sessions. * 
 * @param payload 
 */
void handleFocusEnd(int payload)
{
  int sessionTime = SESSION_TIME * payload;

  setDisplayNumber(sessionTime);
  Serial.print("Diplay time");
  Serial.println(sessionTime);
}