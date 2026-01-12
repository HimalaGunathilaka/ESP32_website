# Project Setup Guide

## 📌 Note
- The current working branch is `mqtt`.

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