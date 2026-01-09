// Following include wifi_server + arduino + pubsubclient
#include "mqtt.h"
#include "buttons.h"
#include "wifi_server.h"
#include "led.h"
#include "display.h"

// ====================================================
// ====================================================
// ====================================================
void setup()
{
  Serial.begin(115200);

  total_time = 0;

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
  if (count == 0)
    server.handleClient();

  buttonPress_focus();

  showLED();
  displayUpdate();
}