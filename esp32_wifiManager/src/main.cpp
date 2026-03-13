// Following include wifi_server + arduino + pubsubclient
#include "mqtt.h"
#include "buttons.h"
#include "wifi_mgr.h"
#include "led.h"
#include "display.h"

#include <ESPmDNS.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include <Preferences.h>

WebServer server(80);
Preferences prefs;

#define BUZZER_PIN 23

#define BUZZER_CHANNEL 0
#define BUZZER_RESOLUTION 8

// int sessionCount = 0;

void beep(unsigned int freq, unsigned int durationMs)
{
  ledcWriteTone(BUZZER_CHANNEL, freq);
  delay(durationMs);
  ledcWriteTone(BUZZER_CHANNEL, 0);
}

// ====================================================
// ====================================================
// ====================================================
void setup()
{
  Serial.begin(115200);

  // Startup file system
  prefs.begin("device", false);

  total_time = 0;

  // Buzzer
  ledcSetup(BUZZER_CHANNEL, 2000, BUZZER_RESOLUTION);
  ledcAttachPin(BUZZER_PIN, BUZZER_CHANNEL);
  ledcWrite(BUZZER_CHANNEL, 0);

  // LEDs
  pinMode(ONBOARD_LED, OUTPUT);
  pinMode(LED_INDICATOR, OUTPUT);

  // Buttons
  pinMode(BUTTON_FOCUS, INPUT_PULLUP);

  attachInterrupt(digitalPinToInterrupt(BUTTON_FOCUS),
                  handleFocusButtonInterrupt,
                  RISING);

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

  server.on("/device-info", HTTP_POST, []()
            {

              if(!server.hasArg("plain")){
                server.send(400, "application/json", "{\"error\":\"No body\"}");
                return;
              }

              String body = server.arg("plain");

              StaticJsonDocument<200> doc;
              DeserializationError error = deserializeJson(doc,body);

              if(error){
              server.send(400, "application/json", "{\"error\":\"Invalid JSON\"}");
              return;
              }

              const char* username = doc["username"];
              if (!username) {
                server.send(400, "application/json", "{\"error\":\"No username\"}");
                return;
              }
              // ---- SAVE (overwrite if exists) ----
              prefs.putString("username", username);

              uint64_t id = ESP.getEfuseMac();
              char buf[20];
              sprintf(buf, "%04X%08X", (uint16_t)(id >> 32), (uint32_t)id);
              server.send(200, "application/json", String("{\"device_id\":\"") + buf + "\"}"); 
            }
          );

  server.begin();
  Serial.println("HTTP server started");

  displayInit();
  setDisplayNumber(0);
  initLED();
}

void loop()
{
  if (WiFi.status() != WL_CONNECTED)
  {
    wm.autoConnect("ESP32-WiFi", "password");
    return;
    // If goes to return below will not be achieved.
  }

  server.handleClient();

  tryReconnecting_MQTT();

  if (client.connected())
  {
    client.loop();
  }

  // This indicates that the mqtt server is connected
  digitalWrite(ONBOARD_LED, HIGH);
  buttonPress_focus();

  // Session complete logic
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

  showLED();
  displayUpdate();
}