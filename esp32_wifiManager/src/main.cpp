#include <Arduino.h>
#include "wifi_server.h"
#include <PubSubClient.h>
#include "led.h"
#include "display.h"

// -------------------------
// Pins
// -------------------------
#define BUTTON_MQTT 33
#define BUTTON_FOCUS 18
#define LED_INDICATOR 19
#define ONBOARD_LED 2

// --------------------------
// MQTT - WiFi
// --------------------------
WiFiClient espClient;
PubSubClient client(espClient);

const char *topic = "focus/activate";
// const char *mqttUsername = "your_username";  // Replace with your MQTT username
// const char *mqttPassword = "your_password";  // Replace with your MQTT password

// -------------------------
// Global State
// -------------------------
int count = 0;
int count_focus = 0;
unsigned long lastMQTTAttempt = 0;
const unsigned long mqttRetryInterval = 5000;

bool focusMode = false;

// -----------------
unsigned long lastButtonTime = 0;
const unsigned long debounceMs = 300;
volatile bool buttonFocusPressed = false;

// -------------------------
// ISR
// -------------------------
void IRAM_ATTR handleMQTTButtonInterrupt()
{
  buttonMQTTPressed = true;
  detachInterrupt(digitalPinToInterrupt(BUTTON_MQTT));
}
void IRAM_ATTR handleFocusButtonInterrupt()
{
  buttonFocusPressed = true;
  detachInterrupt(digitalPinToInterrupt(BUTTON_FOCUS));
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

// --------------------------------------------
// Handling buttons
// --------------------------------------------
void buttonPress_MQTT()
{
  if (!buttonMQTTPressed)
    return;

  count = (count + 1) % 2;
  buttonMQTTPressed = false;
  delay(300);
  attachInterrupt(digitalPinToInterrupt(BUTTON_MQTT),
                  handleMQTTButtonInterrupt,
                  RISING);

  Serial.println("MQTT Button pressed!!");
}

void buttonPress_focus()
{
  if (!buttonFocusPressed)
    return;

  Serial.println("Focus pressed!");

  unsigned long now = millis();
  if (now - lastButtonTime < debounceMs)
    return;
  lastButtonTime = now;

  if (!client.connected())
    return;

  if (focusMode)
    client.publish(topic, "DEACTIVATE");
  else
    client.publish(topic, "ACTIVATE");

  buttonFocusPressed = false;
  attachInterrupt(digitalPinToInterrupt(BUTTON_FOCUS),
                  handleFocusButtonInterrupt,
                  RISING);
}

// ====================================================
// ====================================================
// ====================================================
void setup()
{
  Serial.begin(115200);

  total_time = 0;

  pinMode(ONBOARD_LED, OUTPUT);
  pinMode(LED_INDICATOR, OUTPUT);
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

  if (client.connected())
  {
    client.loop();
  }

  // This indicates that the mqtt server is connected
  digitalWrite(ONBOARD_LED, HIGH);

  buttonPress_MQTT();

  // Show and handle the mqtt website
  if (count == 0)
    server.handleClient();

  buttonPress_focus();

  showLED();
  displayUpdate();
}