/**
 * @fileoverview Manages MQTT connectivity and message routing for focus sessions.
 */

import { sendTo_server } from './serverLogic.js';
import mqtt from "../libs/mqtt.esm.js";

export let client = null;
const MQTT_CONFIG = {
  host: 'localhost',
  port: 9001,
  protocol: 'ws',
  reconnectPeriod: 5000, // Increased for stability
  connectTimeout: 5000
};

/**
 * Main entry point for MQTT. Ensures only one connection exists.
 * 
 * @returns 
 */
async function initializeMQTT() {
  const { username, isLogged, token } = await chrome.storage.local.get([
    'username', 'isLogged', 'token'
  ]);

  // Early exit if unauthorized
  if (!isLogged || !username) return;

  // Clean up existing client before reconnecting
  if (client) {
    client.end(true);
    client = null;
  }

  const url = `${MQTT_CONFIG.protocol}://${MQTT_CONFIG.host}:${MQTT_CONFIG.port}/mqtt`;

  const options = {
    clean: true,
    reconnectPeriod: MQTT_CONFIG.reconnectPeriod,
    connectTimeout: MQTT_CONFIG.connectTimeout,
    clientId: `worker-${crypto.randomUUID()}`,
    username: "himala", // Use dynamic username
    password: "123"   // Usually, token is used as password in pro apps
  };

  client = mqtt.connect(url, options);

  setupEventHandlers(username);
}

/** 
 * Initializes MQTT and handles potential errors. 
 * 
 */
export function safeMQTTInit() {
  try {
    initializeMQTT();
  } catch (err) {
    console.warn('MQTT initialization failed (non-critical):', err);
  }
}


/**
 * Attaches handlers to the MQTT client.
 * @param {string} username The current user's handle.
 */
function setupEventHandlers(username) {
  if (!client) return;

  client.on('connect', async () => {
    console.log('MQTT: Connected to broker');
    client.subscribe(`${username}/focus/#`);

    // Sync initial state from server
    await syncInitialState();
  });

  client.on('message', async (topic, payload) => {
    const message = payload.toString();
    // Fetch all needed state once per message
    const state = await chrome.storage.local.get(['sessionCount', 'urlMutex', 'block']);

    handleIncomingMessage(topic, message, state, username);
  });

  client.on('error', (err) => {
    console.error('MQTT: Error context:', err.message);
  });

  // Note: mqtt.js handles reconnection automatically via reconnectPeriod.
  // We don't need a manual setTimeout(initializeMQTT) unless the process crashes.
}

/**
 * Logic for handling specific MQTT topics.
 * 
 * @param {string} topic 
 * @param {string} payload 
 * @param {object} state 
 * @param {string} username 
 * @returns 
 */
async function handleIncomingMessage(topic, payload, state, username) {
  const { sessionCount, urlMutex, block = [] } = state;
  let responsePayload = null;

  // 1. Focus Activation Logic
  if (topic === `${username}/focus/activate`) {
    const isActivating = payload.startsWith('a|');
    const parts = payload.split('|');
    const receivedCount = parseInt(parts[1] || parts[2]);

    await chrome.storage.local.set({
      focusSource: 'mqtt',
      focusMode: isActivating
    });

    if (!isNaN(receivedCount)) {
      if (receivedCount < sessionCount) {
        responsePayload = `${sessionCount}`;
      } else if (receivedCount > sessionCount) {
        await chrome.storage.local.set({ sessionCount: receivedCount });
      }
    }
  }

  // 2. Block List Logic (Extension specific)
  if (topic === `${username}/focus/block/extension`) {
    if (urlMutex === 'local') {
      await chrome.storage.local.set({ urlMutex: 'none' });
      return;
    }

    const action = payload[0]; // 'a' or 'd'
    const targetUrl = payload.slice(2);
    const updatedBlock = [...block];

    if (action === 'a' && !updatedBlock.includes(targetUrl)) {
      updatedBlock.push(targetUrl);
    } else if (action === 'd') {
      const index = updatedBlock.indexOf(targetUrl);
      if (index > -1) updatedBlock.splice(index, 1);
    }

    await chrome.storage.local.set({ urlMutex: 'mqtt', block: updatedBlock });
  }

  // Send feedback if necessary
  if (responsePayload && client) {
    client.publish(`${username}/focus/count`, responsePayload);
  }
}

/**
 * Fetches initial device and block list data.
 */
async function syncInitialState() {
  try {
    const { deviceId } = await chrome.storage.local.get('deviceId');

    if (!deviceId) {
      const id = await sendTo_server('GET', '/device/get');
      if (id) await chrome.storage.local.set({ deviceId: id });
    }

    const listData = await sendTo_server('GET', '/url/list');
    if (listData?.block) {
      await chrome.storage.local.set({ urlMutex: 'mqtt', block: listData.block });
    }
  } catch (err) {
    console.warn('Sync failed:', err);
  }
}