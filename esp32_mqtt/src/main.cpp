#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include "wifi_custom.h"
#include "display.h"
#include "led.h"
#include "hash.h"

// -------------------------
// Pins
// -------------------------
#define BUTTON_PIN 18
#define LED_INDICATOR 19
#define ONBOARD_LED 2

// ------------------------------
// Button debounce
// -----------------------------
unsigned long lastButtonTime = 0;
const unsigned long debounceMs = 300;

// -------------------------
// Global State
// -------------------------
volatile bool buttonPressed = false;
bool focusMode = false; // single source of truth
int count = 0;

// -------------------------
// ISR
// -------------------------
void IRAM_ATTR handleButtonInterrupt()
{
  buttonPressed = true;
  detachInterrupt(digitalPinToInterrupt(BUTTON_PIN));
}

// -------------------------
// Apply focus state to hardware
// -------------------------
void applyFocusState()
{
  if (focusMode)
  {
    digitalWrite(LED_INDICATOR, HIGH);

    int row = (count - 1) % 9;
    // setDisplayNumber(count);
    Serial.println(count);

    if (row == 8)
      clearLED();
    else
      setRow(row, CRGB::Red);

    Serial.println("FOCUS MODE ON");
  }
  else
  {
    digitalWrite(LED_INDICATOR, LOW);
    Serial.println("FOCUS MODE OFF");
  }
}

// ----------------------------
// MQTT broker
// ----------------------------
const char *mqtt_broker = "10.108.150.105"; // Put the ip of the laptop

// Function to handle "d|<clientId>|<totalTime>" payload
void handleSessionEnd(char *payload)
{
  // Copy payload to a temporary string
  char msg[strlen(payload) + 1];
  strcpy(msg, payload);

  // Split by '|'
  char *eventType = strtok(msg, "|");     // "d"
  char *clientId = strtok(NULL, "|");     // e.g., "483921"
  char *totalTimeStr = strtok(NULL, "|"); // e.g., "120"

  if (eventType && clientId && totalTimeStr)
  {
    long sessionTime = atol(totalTimeStr);

    total_time += sessionTime; // aggregate total time
    int display_time = total_time / 60;

    // Update display in minutes
    setDisplayNumber(display_time);
    Serial.print("Display time");
    Serial.println(display_time);
  }
}

// Callback function: Called when a message arrives
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
      count++;
    focusMode = true;
    applyFocusState();
  }
  else if (strncmp(msg, "d|", 2) == 0)
  {
    focusMode = false;
    char *event = strtok(msg, "|");
    char *clientId = strtok(NULL, "|");
    char *timeStr = strtok(NULL, "|");

    if (!clientId || !timeStr)
      return;

    uint32_t key = hashClientId(clientId);
    long seconds = atol(timeStr);

    hashPut(key, seconds);

    long total = getGlobalTotal();

    Serial.print("Client hash ");
    Serial.print(key);
    Serial.print(" total = ");
    Serial.println(total);

    setDisplayNumber(total / 60);
  }
}

// -------------------------
// Button handling
// -------------------------
void handleButton()
{
  if (!buttonPressed || !client.connected())
    return;
  Serial.println("Button pressed!");

  unsigned long now = millis();
  if (now - lastButtonTime < debounceMs)
    return;
  lastButtonTime = now;

  if (focusMode)
    client.publish(topic, "DEACTIVATE");
  else
    client.publish(topic, "ACTIVATE");

  buttonPressed = false;
  attachInterrupt(digitalPinToInterrupt(BUTTON_PIN),
                  handleButtonInterrupt,
                  RISING);
}

void setup()
{
  Serial.begin(115200);
  setup_wifi();

  client.setServer(mqtt_broker, mqtt_port);
  client.setCallback(callback);

  // Hardware initialization for dispaly focus mode
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED_INDICATOR, OUTPUT);
  pinMode(ONBOARD_LED, OUTPUT);

  attachInterrupt(digitalPinToInterrupt(BUTTON_PIN),
                  handleButtonInterrupt,
                  RISING);

  displayInit();
  setDisplayNumber(0);

  initLED();
}

void loop()
{
  if (!client.connected())
  {
    digitalWrite(LED_BUILTIN, LOW);
    reconnect();
  }
  digitalWrite(LED_BUILTIN, HIGH);

  handleButton();

  client.loop();

  showLED();
  displayUpdate();
}