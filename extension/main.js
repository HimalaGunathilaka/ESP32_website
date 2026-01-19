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

importScripts('libs/mqttws31.min.js');



const REDIRECT_RULE_ID = 1;
// const RESET_TIME = 600000; // 10 minutes
// const WS_URL = "ws://192.168.1.19:81";
const COOLOFF_TIME = 5000;

// When false, this will block publishing changes during initial load from server
// Set to true only after the initial block list is fully loaded
let initBlockMutex = false;
let isInitialLoad = true; // Flag to track if we're doing the initial fetch

// -------------------- Init storage safely --------------------
chrome.storage.local.get(
    ["focusMode", "total_time", "absoluteFocusmode", 
        "start", "block", "command", "urlMutex", 
        "sessionComplete","sessionCompleteIndicator", "sessionTime"],
    (data) => {
        if (data.focusMode === undefined)
            chrome.storage.local.set({ focusMode: false });

        if (data.total_time === undefined)
            chrome.storage.local.set({ total_time: 0 });

        if (data.absoluteFocusmode === undefined)
            chrome.storage.local.set({ absoluteFocusmode: false });

        if (data.start === undefined)
            chrome.storage.local.set({ start: 0 });

        // The blocked list
        if (data.block === undefined)
            chrome.storage.local.set({
                block: [
                ]
            })


        if (data.urlMutex === undefined)
            chrome.storage.local.set({
                urlMutex: "none"  // "none" = no lock, "mqtt" = from MQTT, "local" = from local
            });

        // If a command to change not the focusmode the absolute focus mode occurs
        // A indicator to say a signal was received.
        if (data.command === undefined) {
            chrome.storage.local.set({
                command: false
            })
        }

        if (data.source === undefined) {
            chrome.storage.local.set({
                source: false
            })
        }
        // session logic
        if (data.sessionComplete === undefined) {
            chrome.storage.local.set({
                sessionComplete: false
            });
        }

        if(data.sessionCompleteIndicator === undefined){
            chrome.storage.local.set({
                sessionCompleteIndicator:false
            })
        }

        if(data.sessionTime === undefined){
            chrome.storage.local.set({
                sessionTime: 1 // In minutes
            })
        }
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
const REDIRECT_RULE_BASE_ID = 1000; // base id to avoid collisions


async function enableRedirectRules() {
    const { block = [] } = await chrome.storage.local.get("block");

    // Remove previous redirect rules (use index-based IDs)
    const removeRuleIds = block.map((_, i) => REDIRECT_RULE_BASE_ID + i);

    // Create redirect rules for each blocked site (use index-based IDs for uniqueness)
    const addRules = block
        .filter(site => site) // Filter out empty/null entries
        .map((site, i) => ({
            id: REDIRECT_RULE_BASE_ID + i,
            priority: 1,
            action: {
                type: "redirect",
                redirect: {
                    extensionPath: "/focus.html"
                }
            },
            condition: {
                urlFilter: site,               // ← uses block entries
                resourceTypes: ["main_frame"]
            }
        }));

    await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds,
        addRules
    });

    // console.log("Redirect rules enabled for:", block);
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


// async function disableRedirectRules() {
//     const { block = [] } = await chrome.storage.local.get("block");

//     const removeRuleIds = block.map((_, i) => REDIRECT_RULE_BASE_ID + i);

//     await chrome.declarativeNetRequest.updateDynamicRules({
//         removeRuleIds
//     });
// }

async function clearAllRedirectRules() {
    const rules = await chrome.declarativeNetRequest.getDynamicRules();
    const ids = rules.map(r => r.id);
    if (ids.length) {
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: ids
        });
    }
}

// ======================================================
// ======================================================
// MQTT
// ======================================================
// ======================================================
let client = null;
let pendingBlockList = []; // Accumulator for incoming block list from server
let sessionSrc = false;

function initializeMQTT() {
    client = new Paho.MQTT.Client("localhost", 9001, "worker-" + crypto.randomUUID());

    chrome.alarms.onAlarm.addListener(() => {
        if (!client || !client.isConnected()); //initializeMQTT();
    })
    // client.onConnectionLost = () => setTimeout(initializeMQTT, 2000);

    client.onMessageArrived = async (msg) => {
        const payload = msg.payloadString;
        const topic = msg.destinationName;

        switch (topic) {
            case "focus/activate":
                if (payload === "ACTIVATE") {
                    chrome.storage.local.set({ focusMode: true });
                }
                else if (payload === "DEACTIVATE") {
                    chrome.storage.local.set({ focusMode: false });
                }
                else if (payload.startsWith("d|")) {
                    // Handle deactivation with time data
                    
                    if(payload == "d|c"){
                        sessionSrc = false;
                        return;
                    }
                    const timeValue = parseInt(payload.split("|")[1], 10);
                    const { src } = await chrome.storage.local.get("src");
                    if (!src) {
                        await chrome.storage.local.set({ total_time: timeValue });
                    }
                }
                break;
            case "focus/command": {
                const { source } = await chrome.storage.local.get("source");

                if (!source) {
                    await chrome.storage.local.set({ command: true });

                    if (payload === "act") {
                        await chrome.storage.local.set({ focusMode: true });
                    } else if (payload === "dact") {
                        await chrome.storage.local.set({ focusMode: false });
                    }
                } else {
                    await chrome.storage.local.set({ source: false });
                }
                break;
            }
            case "focus/block/extension": {
                const { urlMutex } = await chrome.storage.local.get("urlMutex");
                console.log("urlMutex:", urlMutex);

                if (urlMutex === "local") {
                    // This is an echo from our own local change, ignore it
                    await chrome.storage.local.set({ urlMutex: "none" });
                } else {
                    const result = await chrome.storage.local.get("block");
                    const block = result.block || [];
                    const event = payload[0];
                    const url = payload.slice(2);

                    console.log("event:", event);
                    console.log("url:", url);

                    // Check if URL already exists (prevent duplicates and loops)
                    const urlExists = block.includes(url);

                    if (event === 'a' && !urlExists) {
                        block.push(url);
                        await chrome.storage.local.set({ urlMutex: "mqtt" }); // Mark as MQTT-originated
                        chrome.storage.local.set({ block: block });
                    } else if (event === 'd' && urlExists) {
                        const index = block.indexOf(url);
                        block.splice(index, 1);
                        await chrome.storage.local.set({ urlMutex: "mqtt" }); // Mark as MQTT-originated
                        chrome.storage.local.set({ block: block });
                    }
                }
                break;
            }
            case "focus/block/server": {
                console.log(payload);
                if (payload[0] === "s") {
                    // Start of block list - clear accumulator and set loading state
                    pendingBlockList = [];
                    isInitialLoad = true;
                    initBlockMutex = false;
                    console.log("Started receiving block list from server");
                    return;
                } else if (payload[0] === "e") {
                    // End of block list - save all at once
                    await chrome.storage.local.set({ block: pendingBlockList });
                    console.log("Block list loaded:", pendingBlockList);
                    // Set both flags to allow normal operation
                    initBlockMutex = true;
                    isInitialLoad = false;
                    return;
                }

                // Accumulate URLs in memory (not storage) to avoid race condition
                const url = payload.slice(2);
                if (url && !pendingBlockList.includes(url)) {
                    pendingBlockList.push(url);
                }

                break;
            }
            case "focus/server/totalTime": {
                const { total_time } = await chrome.storage.local.get("total_time");
                const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
                const totalTimeMsg = new Paho.MQTT.Message(`t|${currentDate}|${total_time}`);
                totalTimeMsg.destinationName = "focus/block/extension";
                client.send(totalTimeMsg);

                await chrome.storage.local.set({ total_time: 0 });
                break;
            }
        }
        console.log(payload);
    };

    client.connect({
        userName: "himala",
        password: "123",
        keepAliveInterval: 60, // in seconds
        onSuccess: async () => {
            try {
                if (!client || !client.isConnected()) {
                    console.warn("Client not connected in onSuccess, retrying...");
                    setTimeout(initializeMQTT, 2000);
                    return;
                }

                client.subscribe("focus/#");

                // Fetch the state of focus from server
                const fetchState = new Paho.MQTT.Message("s|----");
                fetchState.destinationName = "focus/block/extension";
                client.send(fetchState);

                // +++++++++++++++++++++++++++++++++++++++++++++++++++
                // Initial fetch for the block list from mongodb
                // +++++++++++++++++++++++++++++++++++++++++++++++++++
                // Set flags to indicate we're loading (don't clear block list yet)
                isInitialLoad = true;
                initBlockMutex = false;
                const fetchBlockList = new Paho.MQTT.Message("g|----");
                fetchBlockList.destinationName = "focus/block/extension";
                client.send(fetchBlockList);
            } catch (err) {
                console.error("MQTT onSuccess error:", err);
                setTimeout(initializeMQTT, 2000);
            }

        },
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
    if (area !== "local") return;

    const abs = await chrome.storage.local.get("absoluteFocusmode");

    if (changes.block) {
        const { urlMutex } = await chrome.storage.local.get("urlMutex");

        // Don't process any block changes during initial load
        if (isInitialLoad) {
            console.log("Skipping block change during initial load");
            return;
        }

        // Don't process if we're not ready yet (mutex not set)
        if (!initBlockMutex) {
            console.log("Skipping block change - mutex not ready");
            return;
        }

        if (urlMutex === "mqtt") {
            // This change came from MQTT, don't republish (prevents echo loop)
            await chrome.storage.local.set({ urlMutex: "none" });
        } else if (client && client.isConnected()) {
            // This change is local, publish it to MQTT
            await chrome.storage.local.set({ urlMutex: "local" }); // Mark as local-originated
            const oldArr = changes.block.oldValue || [];
            const newArr = changes.block.newValue || [];

            const lenOld = oldArr.length;
            const lenNew = newArr.length;

            // publish the changes
            if (lenOld < lenNew) {
                for (let i = lenOld; i < lenNew; i++) {
                    const msgURL = new Paho.MQTT.Message(`a|${newArr[i]}`);
                    msgURL.destinationName = "focus/block/extension";
                    client.send(msgURL);
                }
            } else {
                for (let i = lenNew; i < lenOld; i++) {
                    const msgURL = new Paho.MQTT.Message(`d|${oldArr[i]}`);
                    msgURL.destinationName = "focus/block/extension";
                    client.send(msgURL);
                }
            }
        }
        if (abs.absoluteFocusmode) await redirectCurrentTab();
    }

    if (changes.absoluteFocusmode) {
        // console.log("abs was changed!");

        const { command } = await chrome.storage.local.get("command");

        // console.log(command)

        const isEnabled = changes.absoluteFocusmode.newValue;
        if (command === false && client && client.isConnected()) {

            const msg = new Paho.MQTT.Message(isEnabled ? "act" : "dact");
            msg.destinationName = "focus/command";
            client.send(msg);

            await chrome.storage.local.set({ source: true });

        }

        if (isEnabled) {
            const {sessionTime} = await chrome.storage.local.get("sessionTime");
            chrome.alarms.create("focusSessionEnd", { delayInMinutes: sessionTime });
        } else {
            const { sessionComplete } = await chrome.storage.local.get("sessionComplete");
            if (!sessionComplete) {
                chrome.alarms.clear("focusSessionEnd");
            }
        }

        // reset command flag if it was set
        if (command) {
            await chrome.storage.local.set({ command: false });
        }
    }


    if (!changes.focusMode) return;

    // console.log("Inside")
    const newFocus = changes.focusMode.newValue;
    // const source = changes.source?.newValue;
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
        await clearAllRedirectRules();
        await chrome.storage.local.set({ absoluteFocusmode: false });
        await chrome.storage.local.set({ focusMode: false });

        await elapsedSeconds();

        // console.log("Focus mode OFF");

        if (client && client.isConnected()) {

            const { sessionComplete } = await chrome.storage.local.get("sessionComplete");

            if (sessionComplete && sessionSrc) {
                const msg = new Paho.MQTT.Message("d|c");
                msg.destinationName = "ffocus/activate";
                client.send(msg);
                chrome.storage.local.set({ sessionComplete: false });
                sessionSrc = false;
            } else {
                chrome.storage.local.get(["total_time"], (data) => {
                    const totalTime = data.total_time ?? 0;
                    // Flag to deactivate `d` and total focus time is being sent. 
                    // Client id is not used
                    const payload = `d|n|${totalTime}`;

                    const msg = new Paho.MQTT.Message(payload);
                    msg.destinationName = "focus/activate";
                    client.send(msg);
                });

            }
        }
    }
});




// ===============================
// Keep alive - Since the extension it self can become idle (Even if the inbuilt heart beat of mqtt)
// ===============================
chrome.alarms.create("mqttPing", { periodInMinutes: 0.5 });

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
    const {sessionCompleteIndicator} = await chrome.storage.local.get("sessionCompleteIndicator");
    await chrome.storage.local.set({sessionCompleteIndicator:!sessionCompleteIndicator})
    sessionSrc = true;  // Set BEFORE focusMode changes to avoid race condition
    await chrome.storage.local.set({ focusMode: false });
}


