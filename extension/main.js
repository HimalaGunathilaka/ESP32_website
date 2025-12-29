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

importScripts('mqttws31.min.js');

const REDIRECT_RULE_ID = 1;
const RESET_TIME = 600000; // 10 minutes
// const WS_URL = "ws://192.168.1.19:81";
const COOLOFF_TIME = 5000;

// -------------------- Init storage safely --------------------
chrome.storage.local.get(
    ["focusMode", "total_time", "absoluteFocusmode", "start", "block"],
    (data) => {
        if (data.focusMode === undefined)
            chrome.storage.local.set({ focusMode: false });

        if (data.total_time === undefined)
            chrome.storage.local.set({ total_time: 0 });

        if (data.absoluteFocusmode === undefined)
            chrome.storage.local.set({ absoluteFocusmode: false });

        if (data.start === undefined)
            chrome.storage.local.set({ start: 0 });

        if (data.block === undefined)
            chrome.storage.local.set({
                block: [
                ]
            })
    }
);

// ======================================================
// ======================================================
// Time related stuff
// ======================================================
// ======================================================

// -------------------- Time tracking --------------------
async function elapsedSeconds() {
    const end = Date.now();
    const { start = 0, total_time = 0 } =
        await chrome.storage.local.get(["start", "total_time"]);

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
    // const { total_time = 0 } = await chrome.storage.local.get(["total_time"]);
    // console.log("total_time:", total_time);
    chrome.storage.local.set({ total_time: 0 });
}


// ======================================================
// ======================================================
// Tabs and redirecting
// ======================================================
// ======================================================

// -------------------- Redirect logic --------------------
async function enableRedirectRules() {
    await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [REDIRECT_RULE_ID],
        addRules: [
            {
                id: REDIRECT_RULE_ID,
                priority: 1,
                action: {
                    type: "redirect",
                    redirect: { extensionPath: "/focus.html" }
                },
                condition: {
                    urlFilter: "*",
                    resourceTypes: ["main_frame"]
                }
            }
        ]
    });
    // console.log("Redirect rules enabled");
}


// ----Check all tabs and block them-----
async function redirectCurrentTab() {
    const tabs = await chrome.tabs.query({});
    const { block = [] } = await chrome.storage.local.get("block");

    for (const tab of tabs) {
        if (!tab?.id || !tab?.url) continue;
        if (tab.url.includes("focus.html")) continue;
        // if (tab.url.startsWith("chrome://") || tab.url.startsWith("brave://")) continue;

        // Iterate over all the urls inside of block
        if (block.some(site => tab.url.includes(site))) {
            chrome.tabs.update(tab.id, {
                url: chrome.runtime.getURL("focus.html")
            });
        }
    }
}



async function disableRedirectRules() {
    await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [REDIRECT_RULE_ID]
    });
    // console.log("Redirect rules disabled");
}

// ======================================================
// ======================================================
// MQTT
// ======================================================
// ======================================================
let client = null;

function initializeMQTT() {
    client = new Paho.MQTT.Client("localhost", 9001, "worker-" + Math.random());
    client.onConnectionLost = () => setTimeout(initializeMQTT, 2000);

    client.onMessageArrived = (msg) => {
        const payload = msg.payloadString;
        console.log(payload);
        if (payload === "ACTIVATE") {
            chrome.storage.local.set({ focusMode: true });
        }
        if (payload === "DEACTIVATE") {
            chrome.storage.local.set({ focusMode: false });
        }
    };

    client.connect({
        userName: "himala",
        password: "123",
        keepAliveInterval: 60, // in seconds
        onSuccess: () => client.subscribe("focus/activate"),
        onFailure: () => setTimeout(initializeMQTT, 2000),
    });
}

initializeMQTT();

// ======================================================
// ======================================================
// Triggers for when focusMode is changed
// ======================================================
// ======================================================

// -------------------- Reactive observer --------------------
chrome.storage.onChanged.addListener(async (changes, area) => {
    // console.log("Start of observer");
    if (area !== "local" || !changes.focusMode) return;

    // console.log("Inside")
    const newFocus = changes.focusMode.newValue;
    const source = changes.source?.newValue;
    const { start } = await chrome.storage.local.get("start");


    if (newFocus) {

        if (start === 0) {
            await chrome.storage.local.set({ start: Date.now() });
        }

        await enableRedirectRules();
        await redirectCurrentTab();
        await chrome.storage.local.set({ absoluteFocusmode: true });

        // console.log("Focus mode ON");

        if (client && client.isConnected()) {
            const msg = new Paho.MQTT.Message("activate");
            msg.destinationName = "focus/activate";
            client.send(msg);
        }

    } else {
        const elapsed = Date.now() - start;

        // console.log("tried")
        if (elapsed < COOLOFF_TIME) {
            // console.log("Deactivation blocked (1 min lock)");
            // console.log(elapsed);

            // Re-assert truth
            await chrome.storage.local.set({
                focusMode: true,
                absoluteFocusmode: true
            });

            return;
        }

        // ---- Deactivation allowed ----
        await disableRedirectRules();
        await chrome.storage.local.set({ absoluteFocusmode: false });
        await chrome.storage.local.set({ focusMode: false });

        await elapsedSeconds();

        // console.log("Focus mode OFF");

        if (client && client.isConnected()) {
            const msg = new Paho.MQTT.Message("deactivate");
            msg.destinationName = "focus/activate";
            client.send(msg);
        }

    }
});