// Following include wifi_server + arduino + pubsubclient
#include "mqtt.h"
#include "buttons.h"
#include "wifi_mgr.h"
#include "led.h"
#include "display.h"

#include <WebServer.h>

#define BUZZER_PIN 23

#define BUZZER_CHANNEL 0
#define BUZZER_RESOLUTION 8

int sessionCount = 0;
WebServer server(80);
bool serverStopped = false;

IPAddress localIP(192, 168, 4, 10); // Custom ESP32 IP
IPAddress gateway(192, 168, 4, 10); // ESP32 acts as gateway
IPAddress subnet(255, 255, 255, 0); // Subnet mask

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

  total_time = 0;

  // Start custom AP
  WiFi.softAPConfig(localIP, gateway, subnet);
  WiFi.softAP("ESP32-WiFi", "password");
  Serial.print("AP IP: ");
  Serial.println(WiFi.softAPIP());

  // 2️⃣ Configure HTTP endpoints
  server.on("/device-info", HTTP_GET, []()
            {
        uint64_t id = ESP.getEfuseMac();
        char buf[20];
        sprintf(buf, "%04X%08X", (uint16_t)(id >> 32), (uint32_t)id);
        server.send(200, "application/json", String("{\"device_id\":\"") + buf + "\"}"); });
  server.begin();
  Serial.println("Custom HTTP server started");

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

  // Non-blocking WiFiManager
  wm.setConfigPortalBlocking(false);
  if (!WiFi.isConnected())
  {
    wm.startConfigPortal("ESP32-WiFi", "password"); // <- starts portal but does NOT block
  }

  displayInit();
  setDisplayNumber(0);
  initLED();
}

void loop()
{
  if (WiFi.status() != WL_CONNECTED)
  {
    server.handleClient();
    wm.process();
  }
  else
  {

    if (!serverStopped)
    {
      server.stop();
      Serial.println("Server stopped, WiFi connected");
      serverStopped = true;
    }

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
  }

  showLED();
  displayUpdate();
}