#include <Arduino.h>
#include "wifi_server.h"

// -------------------------
// Pins
// -------------------------
#define BUTTON_PIN 18
#define LED_INDICATOR 19
#define ONBOARD_LED 2

// -------------------------
// Global State
// -------------------------
int count = 0;

// -------------------------
// ISR
// -------------------------
void IRAM_ATTR handleButtonInterrupt()
{
  buttonPressed = true;
  detachInterrupt(digitalPinToInterrupt(BUTTON_PIN));
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
  if (!WiFi.status())
  {
    wm.autoConnect("ESP32-WiFi", "password");
  }

  if (buttonPressed)
  {
    count++;
    count = count % 2;
    buttonPressed = false;
    delay(300);
    attachInterrupt(digitalPinToInterrupt(BUTTON_PIN), handleButtonInterrupt, RISING);
    Serial.println("Button pressed!!");
    // Serial.println(count);
  }
  if (count==0)
    server.handleClient();
}