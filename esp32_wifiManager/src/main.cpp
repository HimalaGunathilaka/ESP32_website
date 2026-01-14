// Following include wifi_server + arduino + pubsubclient
#include "mqtt.h"
#include "buttons.h"
#include "wifi_server.h"
#include "led.h"
#include "display.h"

int sessionCount = 0;
int lastSessionCount = 0;
const unsigned long sessionInterval = 60000; // 1 minute in milliseconds

#define BUZZER_PIN 23

#define BUZZER_CHANNEL 0
#define BUZZER_RESOLUTION 8

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

  // Buzzer
  ledcSetup(BUZZER_CHANNEL, 2000, BUZZER_RESOLUTION);
  ledcAttachPin(BUZZER_PIN, BUZZER_CHANNEL);
  ledcWrite(BUZZER_CHANNEL, 0);

  // LEDs
  pinMode(ONBOARD_LED, OUTPUT);
  pinMode(LED_INDICATOR, OUTPUT);

  // Buttons
  pinMode(BUTTON_MQTT, INPUT_PULLUP);
  pinMode(BUTTON_FOCUS, INPUT_PULLUP);

  attachInterrupt(digitalPinToInterrupt(BUTTON_MQTT),
                  handleMQTTButtonInterrupt,
                  RISING);
  attachInterrupt(digitalPinToInterrupt(BUTTON_FOCUS),
                  handleFocusButtonInterrupt,
                  RISING);

  // Check for file details
  initialize_pref();
  // This order valid to get MQTT_DETAILS_PRESENT initialized before checking
  initialize_server();

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

  tryReconnecting_MQTT();

  if (client.connected())
  {
    client.loop();
  }

  // This indicates that the mqtt server is connected
  digitalWrite(ONBOARD_LED, HIGH);

  // to open or close MQTT config page
  buttonPress_MQTT();

  // Show and handle the mqtt website
  if (count == 0 || !MQTT_DETAILS_PRESENT)
    server.handleClient();

  buttonPress_focus();

  if (focusMode)
  {
    const unsigned long now = millis() - lastSession;
    const int currentSessionCount = now / sessionInterval;
    if (currentSessionCount > lastSessionCount)
    {
      sessionCount++;
      lastSessionCount = currentSessionCount;

      // Beep when session ends
      beep(2000, 150); // 2kHz for 150 ms

      // Light up one additional LED
      if (sessionCount < NUM_LEDS)
      {
        leds[sessionCount - 1] = CRGB::Red;
      }
    }
  }
  else
  {
    // Reset counters when focus is off
    sessionCount = 0;
    lastSessionCount = 0;
    clearLED();
  }

  showLED();
  displayUpdate();
}