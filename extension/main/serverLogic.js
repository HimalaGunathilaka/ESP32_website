/**
 * @fileoverview Centralized logic for network requests to the backend server
 * and the ESP32 device.
 */

const SERVER_BASE = "http://localhost:8080";

/**
 * Generic fetch wrapper for server communication.
 * @param {string} method HTTP verb (GET, POST, etc.)
 * @param {string} endpoint API path starting with /
 * @param {Object} [payload] Data to send in the body
 * @returns {Promise<any|null>} Response data or null on failure
 */
export async function sendTo_server(method, endpoint, payload) {
    try {
        const { token, isLogged } = await chrome.storage.local.get(['token', 'isLogged']);

        if (!isLogged || !token) {
            // Don't log out, just warn. The user might be offline.
            console.warn('Action requires authentication: skipping sync.');
            return null;
        }

        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        };

        if (method !== 'GET' && payload) {
            options.body = JSON.stringify(payload);
        }

        const response = await fetch(`${SERVER_BASE}${endpoint}`, options);

        // Handle session expiration
        if (response.status === 401) {
            console.error('Session expired. Logging out.');
            await chrome.storage.local.set({ isLogged: false, username: 'Guest' });
            return null;
        }

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Server error (${response.status}):`, errorText);
            return null;
        }

        // Try to parse JSON for any request that returns content
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        }

        return true;
    } catch (err) {
        // Network error (Server down, no internet)
        console.error('Network request failed:', err.message);
        return null;
    }
}

/**
 * Communicates with the local ESP32 device to retrieve hardware info.
 * Includes a timeout to prevent the service worker from hanging.
 */
export async function fetchDeviceId() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
        const response = await fetch("http://esp32.local/device-info", {
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) throw new Error('ESP32 unreachable');

        const data = await response.json();
        console.log('Successfully connected to ESP32:', data.device_id);
        return data.device_id;
    } catch (err) {
        if (err.name === 'AbortError') {
            console.warn('ESP32 request timed out.');
        } else {
            console.error('ESP32 connection failed:', err.message);
        }
        return null;
    }
}
