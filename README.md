# FocusTimer
This project was for creating a Pomodorro based chromium extension creation. But as part of the project I had create a hardware switch to control the extension as well. The high level architecture of the project is as bellow.
<img width="476" height="497" alt="image" src="https://github.com/user-attachments/assets/148e8986-dcf2-4575-960e-f2bf3e69e80f" />

The extension popup UI looks as bellow. <br>
<img width="343" height="571" alt="image" src="https://github.com/user-attachments/assets/28c66d6d-e520-4a67-b91c-1e8a81c0db9b" />

As for the hardware switch, I haven't worked on the enclosure yet. But a function-able demo of my current project is shown in [here](https://drive.google.com/file/d/1WPymxkI9dWA7hH-WlM9zqBF2JT2rhrRE/view?usp=sharing).


---

# Project Setup Guide

## 📌 Note
- Working branches are pushed to `dev` for now.

---

## 🐳 MQTT Server (Mosquitto)

### Prerequisites
- Docker installed on your system  
  **OR**
- A manually configured Mosquitto server running with the following settings:
  - TCP port: `1883`
  - WebSocket port: `9001`
  - Username: `himala`
  - Password: `123`

### Running the MQTT Server (Docker)
1. Navigate to the `mosquitto_server` directory.
2. Start the container using one of the following methods:
   - **Terminal**: `docker compose up -d`
   - **Docker Desktop**: Open Docker Desktop and run the Compose configuration from the UI.

---

## 🧩 Browser Extension Setup

1. Open a Chromium-based browser.
2. Navigate to `chrome://extensions`
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the extension folder located at the **root of this repository**.

---

## 🖥️ Backend Server

### Prerequisites
- Node.js installed
- A `.env` file (shared separately) placed inside the `server` directory

### Running the Server
1. Navigate to the `server` directory.
2. Start the server by running `node server.js`.

---

## ✅ Summary
- Use the `mqtt` branch
- Start the Mosquitto MQTT server using Docker
- Load the browser extension manually via Chromium extensions
- Run the Node.js backend with the provided `.env` file

---

## 🔌 Hardware (ESP32)
- The current ESP32 project is **`esp32_wifiManager`**.
