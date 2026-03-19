/**
 * @file main.cpp
 * @author Himala Gunathilaka
 * @brief 
 * @version 0.1
 * @date 2026-03-17
 * 
 * @copyright Copyright (c) 2026
 * 
 */
#include "mqtt.h"
#include "buttons.h"
#include "wifi_mgr.h"
#include "led.h"
#include "display.h"

#include <ESPmDNS.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include <Preferences.h>

// @brief Buzzer hardware pin
#define BUZZER_PIN 23

// @brief PWM for the buzzer
#define BUZZER_CHANNEL 0

// @brief PWM resolution for the buzzer
#define BUZZER_RESOLUTION 8

// @brief Global web server instance running on port 80
WebServer server(80);

/// @brief Global preferences instance for non-volatile storage
Preferences prefs;

/**
 * @param freq Frequency of the tone in Hertz (Hz)
 * @param durationMs Duration to play the tone in milliseconds
 */
void beep(unsigned int freq, unsigned int durationMs)
{
  ledcWriteTone(BUZZER_CHANNEL, freq);
  delay(durationMs);
  ledcWriteTone(BUZZER_CHANNEL, 0);
}

/**
 * @brief HTTP POST handler for the "/device-info" endpoint.
 */
void handleDeviceInfoPost()
{
  if (!server.hasArg("plain"))
  {
    server.send(400, "application/json", "{\"error\":\"No body\"}");
    return;
  }

  String body = server.arg("plain");
  StaticJsonDocument<200> doc;
  DeserializationError error = deserializeJson(doc, body);

  if (error)
  {
    server.send(400, "application/json", "{\"error\":\"Invalid JSON\"}");
    return;
  }

  const char *username = doc["username"];
  if (!username)
  {
    server.send(400, "application/json", "{\"error\":\"No username\"}");
    return;
  }

  // Save username to flash memory
  prefs.putString("username", username);

  // Retrieve and format the ESP32 MAC address
  uint64_t id = ESP.getEfuseMac();
  char buf[20];
  sprintf(buf, "%04X%08X", (uint16_t)(id >> 32), (uint32_t)id);

  // Respond with the device ID and username
  String currentUsername = prefs.getString("username", "");
  String response = String("{\"device_id\":\"") + buf + String("\",\"username\":\"") + currentUsername + "\"}";
  server.send(200, "application/json", response);
}

/**
 * @brief Arduino setup()
 */
void setup()
{
  Serial.begin(115200);

  // Initialize non-volatile storage
  prefs.begin("device", false);
  total_time = 0;

  // Initialize Hardware: Buzzer
  ledcSetup(BUZZER_CHANNEL, 2000, BUZZER_RESOLUTION);
  ledcAttachPin(BUZZER_PIN, BUZZER_CHANNEL);
  ledcWrite(BUZZER_CHANNEL, 0);

  // Initialize Hardware: LEDs
  pinMode(ONBOARD_LED, OUTPUT);
  pinMode(LED_INDICATOR, OUTPUT);

  // Initialize Hardware: Buttons
  pinMode(BUTTON_FOCUS, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(BUTTON_FOCUS),
                  handleFocusButtonInterrupt,
                  RISING);

  // Initialize network and mDNS
  wm.autoConnect("ESP32-WiFi", "password");
  if (!MDNS.begin("esp32"))
  {
    Serial.println("Error setting up mDNS responder!");
    while (1)
    {
      delay(1000);
    }
  }
  Serial.println("mDNS responder started");

  // Initialize Web server
  server.on("/device-info", HTTP_POST, handleDeviceInfoPost);
  server.begin();
  Serial.println("HTTP server started");

  // Initialize peripherals
  displayInit();
  setDisplayNumber(0);
  initLED();
}

/**
 * @brief Arduino main
 */
void loop()
{
  // Ensure wifi remains connected
  if (WiFi.status() != WL_CONNECTED)
  {
    wm.autoConnect("ESP32-WiFi", "password");
    return;
  }

  // Process incoming HTTP requests
  server.handleClient();

  // Maintain MQTT connection
  tryReconnecting_MQTT();
  if (client.connected())
  {
    client.loop();
  }

  // Indicates active MQTT connection
  digitalWrite(ONBOARD_LED, HIGH);

  
  buttonPress_focus();

  // Handle session complete logic
  if (sessionComplete)
  {
    sessionCount++;
    beep(2000, 150); // 2kHz for 150ms

    Serial.print("Session count:");
    Serial.println(sessionCount);

    if (sessionCount < NUM_LEDS)
    {
      leds[sessionCount - 1] = CRGB::Red;
    }
    else
    {
      clearLED();
      sessionCount = 0;
    }

    sessionComplete = false;
  }

  // Update displays and LEDs
  showLED();
  displayUpdate();
}