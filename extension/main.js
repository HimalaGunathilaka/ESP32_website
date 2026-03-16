
import { sendTo_server } from './main/serverLogic.js';
import './main/init.js';
import { safeMQTTInit, client } from './main/mqtt.js';
import './main/listeners.js';
import './main/icon.js';

// Initial trigger
safeMQTTInit();

/**
 * Handles extension alarms for keep-alive and session management.
 */
chrome.alarms.onAlarm.addListener(async (alaram) => {
    if (alaram.name === "mqttPing") {
        // Check if logged in first
        const { isLogged } = await chrome.storage.local.get('isLogged');
        if (!isLogged) return;

        // Check if client exists in global scope and is connected
        const isConnected = typeof client !== 'undefined' && client?.connected;
        if (!isConnected) safeMQTTInit();
    }
    else if (alaram.name === "focusSessionEnd") {
        await handleSessionCompletion();

    }
});

/**
 * Processes the end of a focus session, updates storage, and syncs with server.
 */
async function handleSessionCompletion() {
    const today = new Date().toString();
    const data = await chrome.storage.local.get(['sessionCount', 'date']);

    let count = data.sessionCount || 0;

    // Reset count if it's a new day
    if (data.date !== today) {
        count = 0;
    }

    const newCount = count + 1;
    await Promise.all([
        chrome.storage.local.set({
            sessionCount: newCount,
            date: today
        }),
        achieveSession(),
        sendTo_server('POST', '/session/complete', { sessionCount: newCount })
    ]);
}


/**
 * Updates UI state flags for a successful session completion.
 */
async function achieveSession() {
    await chrome.storage.local.set({ sessionComplete: true });
    // Only trigger confetti for natural session completions, not early deactivations
    const { sessionCompleteIndicator } = await chrome.storage.local.get("sessionCompleteIndicator");
    await chrome.storage.local.set({
        sessionCompleteIndicator: !sessionCompleteIndicator,
        naturalCompletion: true,
        focusMode: false
    });
}


/**
 * Self-invoking auth check on startup.
 */
(async () => {
    const isValid = await sendTo_server("GET", "/auth/verify");
    if (isValid) {
        safeMQTTInit();
        console.log("Token is valid");
    }
    else {
        await chrome.storage.local.set({
            username: "Guest",
            isLogged: false,
            focusMode: false,
            block: []
        });
    }
})();

