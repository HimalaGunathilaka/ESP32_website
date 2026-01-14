#include <WiFiManager.h>
#include <WebServer.h>
#include <Preferences.h>

// For broker link
#define BROKER 64

// For username
#define USER 64

// For password
#define PASS 64

WiFiManager wm;
WebServer server(80);

Preferences prefs;

String mqttBroker = "";
String mqttUsername = "";
String mqttPassword = "";

char brokerFile[BROKER + 1] = "";
char usernameFile[USER + 1] = "";
char passFile[PASS + 1] = "";

int mqttPort = 1883;

bool MQTT_DETAILS_PRESENT = false;

// ==============================================================
// File system logic
void initialize_pref()
{
  prefs.begin("mqtt", true); // This will be opened in nvs partition
  MQTT_DETAILS_PRESENT = prefs.isKey("broker") && prefs.isKey("user") && prefs.isKey("pass");

  if (MQTT_DETAILS_PRESENT)
  {
    // Load saved credentials into the String variables used by MQTT
    prefs.getString("broker", brokerFile, sizeof(brokerFile));
    prefs.getString("user", usernameFile, sizeof(usernameFile));
    prefs.getString("pass", passFile, sizeof(passFile));

    // Copy to String variables for MQTT use
    mqttBroker = String(brokerFile);
    mqttUsername = String(usernameFile);
    mqttPassword = String(passFile);

    // Print out the loaded credentials
    Serial.println("MQTT credentials found:");
    Serial.print("Broker: ");
    Serial.println(brokerFile);
    Serial.print("Username: ");
    Serial.println(usernameFile);
    Serial.print("Password: ");
    Serial.println(passFile);
  }
  prefs.end();
}

void saveMQTT(const char *b, const char *u, const char *p)
{
  prefs.begin("mqtt", false);
  prefs.putString("broker", b);
  prefs.putString("user", u);
  prefs.putString("pass", p);
  prefs.end();

  // Mark that credentials are now present
  MQTT_DETAILS_PRESENT = true;
}

// =================================================================

// To be global
volatile bool buttonMQTTPressed = false;

String createHTML()
{
  String str = "<!DOCTYPE html> <html>";
  str += "<head><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0, user-scalable=no\">";
  str += "<style>";
  str += "body {font-family: Arial, sans-serif; color: #444; text-align: center;}";
  str += ".title {font-size: 30px; font-weight: bold; letter-spacing: 2px; margin: 80px 0 55px;}";
  str += ".details {max-width: 400px; margin: 0 auto; text-align: left;}";
  str += "input, button {width: 100%; padding: 12px; margin: 10px 0; box-sizing: border-box; font-size: 16px;}";
  str += "button {background-color: #4285f4; color: white; border: none; cursor: pointer;}";
  str += "button:hover {background-color: #357ae8;}";
  str += "label {font-weight: bold; display: block; margin-top: 10px;}";
  str += "</style>";
  str += "</head>";
  str += "<body>";
  str += "<h1 class=\"title\">MQTT Configuration</h1>";
  str += "<div class=\"details\">";
  str += "<form action='/submit' method='POST'>";
  str += "<label>MQTT Broker:</label>";
  str += "<input type='text' name='broker' placeholder='broker.hivemq.com' required>";
  str += "<label>Username:</label>";
  str += "<input type='text' name='username' placeholder='Enter username' required>";
  str += "<label>Password:</label>";
  str += "<input type='password' name='password' placeholder='Enter password' required>";
  str += "<button type='submit'>Save Configuration</button>";
  str += "</form>";
  str += "</div>";
  str += "</body>";
  str += "</html>";
  return str;
}

void handle_submit()
{
  if (server.hasArg("broker") && server.hasArg("username") && server.hasArg("password"))
  {
    mqttBroker = server.arg("broker");
    mqttUsername = server.arg("username");
    mqttPassword = server.arg("password");

    Serial.println("MQTT Configuration received:");
    Serial.println("Broker: " + mqttBroker);
    Serial.println("Username: " + mqttUsername);
    Serial.println("Password: " + mqttPassword);

    saveMQTT(mqttBroker.c_str(), mqttUsername.c_str(), mqttPassword.c_str());

    server.send(200, "text/html", "<html><body><h1>MQTT Settings Saved!</h1><p>Broker: " + mqttBroker + "</p><a href='/'>Back</a></body></html>");
  }
  else
  {
    server.send(400, "text/plain", "Missing parameters");
  }
}

void handle_onConnect()
{
  server.send(200, "text/html", createHTML());
}

void handle_NotFound()
{
  server.send(404, "text/plain", "Not found");
}

void initialize_server()
{
  bool res;
  // res = wm.autoConnect(); // auto generated AP name from chipid
  // res = wm.autoConnect("AutoConnectAP"); // anonymous ap
  res = wm.autoConnect("ESP32-WiFi", "password"); // password protected ap

  if (!res)
  {
    Serial.println("Failed to connect");
    ESP.restart();
  }
  else
  {
    // if you get here you have connected to the WiFi
    Serial.println("connected...yeey :)");
    Serial.print("I am on:");
    Serial.print(WiFi.localIP());
    server.on("/", handle_onConnect);
    server.on("/submit", HTTP_POST, handle_submit);
    server.onNotFound(handle_NotFound);
    server.begin();
    Serial.println("");
    Serial.println("HTTP server started");
  }
}
