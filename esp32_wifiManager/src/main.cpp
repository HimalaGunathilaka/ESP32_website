// Following include wifi_server + arduino + pubsubclient
#include "mqtt.h"
#include "buttons.h"
#include "wifi_mgr.h"
#include "led.h"
#include "display.h"

#define BUZZER_PIN 23

#define BUZZER_CHANNEL 0
#define BUZZER_RESOLUTION 8

int sessionCount = 0;

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
  pinMode(BUTTON_FOCUS, INPUT_PULLUP);

  attachInterrupt(digitalPinToInterrupt(BUTTON_FOCUS),
                  handleFocusButtonInterrupt,
                  RISING);

  wm.autoConnect("ESP32-WiFi", "password");

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