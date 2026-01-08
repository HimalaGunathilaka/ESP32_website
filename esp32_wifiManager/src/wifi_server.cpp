#include <WiFiManager.h>
#include <WebServer.h>

WiFiManager wm;
WebServer server(80);

String mqttBroker = "";
String mqttUsername = "";
String mqttPassword = "";
int mqttPort = 1883;

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