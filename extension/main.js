
importScripts(
    'libs/mqtt.min.js',
    'main/init.js',
    'main/redirect.js',
    'main/mqtt.js',
    'main/listeners.js',
    'main/icon.js',
    'main/serverLogic.js'
);

const SERVER_BASE = "http://localhost:8080";
const COOLOFF_TIME = 5000;

/** Initializes MQTT and handles potential errors. */
function safeMQTTInit() {
    try {
        initializeMQTT();
    } catch (err) {
        console.warn('MQTT initialization failed (non-critical):', err);
    }
}

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
        sendToServer('POST', '/session/complete', { sessionCount: newCount })
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
    sessionSrc = true;
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

