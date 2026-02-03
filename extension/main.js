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

// const RESET_TIME = 600000; // 10 minutes
// const WS_URL = "ws://192.168.1.19:81";
const COOLOFF_TIME = 5000;


// ======================================================
// ======================================================
// Time related stuff
// ======================================================
// ======================================================

// -------------------- Time tracking --------------------
async function elapsedSeconds() {
    const end = Date.now();
    const today = new Date();
    const { date } = await chrome.storage.local.get("date");

    const { start = 0, total_time = 0 } =
        await chrome.storage.local.get(["start", "total_time"]);

    if (date && new Date(date).toDateString() !== today.toDateString()) {
        sendTo_server("POST", "/time/total", total_time);

        await chrome.storage.local.set({
            start: 0,
            total_time: 0
        });
        return;
    }



    // This condition is set for whenever start was not captured 
    // which implies do not calculate elapsed time for that instance.
    if (start === 0) return;

    const elapsed = Math.floor((end - start) / 1000);
    await chrome.storage.local.set({
        total_time: total_time + elapsed,
        start: 0
    });
}

// --------------Reset total time after t time---------------
// --------------To depict the end of the day----------------
async function resetTotal_time() {
    chrome.storage.local.set({ total_time: 0 });
}


initializeMQTT();


// ===============================
// Keep alive - Since the extension it self can become idle (Even if the inbuilt heart beat of mqtt)
// ===============================

chrome.alarms.onAlarm.addListener(async (alaram) => {
    if (alaram.name === "mqttPing") {
        if (!client || !client.isConnected()) initializeMQTT();
    }
    else if (alaram.name === "focusSessionEnd") {
        await achieveSession();
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
        initializeMQTT();
        console.log("Token is valid");

        // const msgStat = new Paho.MQTT.Message("status");
        // msgStat.destinationName = "focus/activate";
        // client.send(msgStat);

    }
    else {
        await chrome.storage.local.set({ username: "Guest" });
        await chrome.storage.local.set({ isLogged: false });
        await chrome.storage.local.set({ focusMode: false });
        await chrome.storage.local.set({ block: [] });
    }
})();

