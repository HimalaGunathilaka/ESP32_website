// Polyfill for service worker environment
if (typeof window === 'undefined') {
    self.window = self;
    self.localStorage = {
        _data: {},
        setItem: function (id, val) { return this._data[id] = String(val); },
        getItem: function (id) { return this._data.hasOwnProperty(id) ? this._data[id] : undefined; },
        removeItem: function (id) { return delete this._data[id]; },
        clear: function () { return this._data = {}; }
    };
}

importScripts(
    'libs/mqttws31.min.js',
    'main/init.js',
    'main/redirect.js',
    'main/mqtt.js',
    'main/listeners.js',
    'main/icon.js',
    'main/serverLogic.js'
);

const SERVER_BASE = "http://localhost:8080";
const COOLOFF_TIME = 5000;

// Initialize MQTT without blocking the rest of the extension
try {
    initializeMQTT();
} catch (err) {
    console.warn("MQTT initialization failed (non-critical):", err);
}


// ===============================
// Keep alive - Since the extension it self can become idle (Even if the inbuilt heart beat of mqtt)
// ===============================

chrome.alarms.onAlarm.addListener(async (alaram) => {
    if (alaram.name === "mqttPing") {
        if (!client || !client.isConnected()) initializeMQTT();
    }
    else if (alaram.name === "focusSessionEnd") {
        const { sessionCount } = await chrome.storage.local.get("sessionCount");
        const { date } = await chrome.storage.local.get("date");
        const today = new Date();

        if (date && new Date(date).toDateString() !== today.toDateString()) {
            await chrome.storage.local.set({ sessionCount: 0 });
            await chrome.storage.local.set({ date: today });
        }

        await chrome.storage.local.set({ sessionCount: sessionCount + 1 });
        await achieveSession();
        const sendToServer = sessionCount + 1;
        await sendTo_server("POST", "/session/complete", { sessionCount: sendToServer });

    }
});


// ===================================
// Complete session after 25 minutes
// ===================================

async function achieveSession() {
    await chrome.storage.local.set({ sessionComplete: true });
    // Only trigger confetti for natural session completions, not early deactivations
    const { sessionCompleteIndicator } = await chrome.storage.local.get("sessionCompleteIndicator");
    await chrome.storage.local.set({ sessionCompleteIndicator: !sessionCompleteIndicator });
    await chrome.storage.local.set({ naturalCompletion: true }); // Flag for confetti
    sessionSrc = true;  // Set BEFORE focusMode changes to avoid race condition
    await chrome.storage.local.set({ focusMode: false });
}



// =====================================
// Server connection logic stuff
// =====================================

// ------------------------------------------------
// Check whether current session is valid

(async () => {
    const valid = await sendTo_server("GET", "/auth/verify");
    if (valid) {
        try {
            initializeMQTT();
        } catch (err) {
            console.warn("MQTT initialization failed (non-critical):", err);
        }
        console.log("Token is valid");
    }
    else {
        await chrome.storage.local.set({ username: "Guest" });
        await chrome.storage.local.set({ isLogged: false });
        await chrome.storage.local.set({ focusMode: false });
        await chrome.storage.local.set({ block: [] });
    }
})();

