// -------------------- Init storage safely --------------------
chrome.storage.local.get(
    ["focusMode", "absoluteFocusmode",
        "date", "start",
        "block", "urlMutex", "source", "focusSource",
        "sessionCount", "sessionComplete", "sessionCompleteIndicator", "sessionTime",
        "naturalCompletion",
        "isLogged", "username", "token",
        "deviceId", "deviceConnected",
    ],
    (data) => {
        if (data.focusMode === undefined)
            chrome.storage.local.set({ focusMode: false });

        if (data.total_time === undefined)
            chrome.storage.local.set({ total_time: 0 });

        if (data.absoluteFocusmode === undefined)
            chrome.storage.local.set({ absoluteFocusmode: false });

        if (data.start === undefined)
            chrome.storage.local.set({ start: 0 });

        if (data.date === undefined)
            chrome.storage.local.set({ date: new Date() });

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

        if (data.source === undefined) {
            chrome.storage.local.set({
                source: false
            })
        }
        // -----------------------------------------------
        // Focus session logic
        if (data.sessionComplete === undefined) {
            chrome.storage.local.set({
                sessionComplete: false
            });
        }

        if (data.sessionCompleteIndicator === undefined) {
            chrome.storage.local.set({
                sessionCompleteIndicator: false
            })
        }

        if (data.naturalCompletion === undefined) {
            chrome.storage.local.set({
                naturalCompletion: false
            });
        }

        if (data.sessionTime === undefined) {
            chrome.storage.local.set({
                sessionTime: 2 // In minutes
            })
        }

        if (data.sessionCount === undefined) {
            chrome.storage.local.set({
                sessionCount: 0
            })
        }

        if (data.focusSource === undefined) {
            chrome.storage.local.set({
                focusSource: "local"
            })
        }
        //-----------------------------------------------
        // Authentication
        if (data.isLogged === undefined) {
            chrome.storage.local.set({
                isLogged: false
            })
        }

        if (data.username === undefined) {
            chrome.storage.local.set({ username: "Guest" })
        }

        if (data.token === undefined) {
            chrome.storage.local.set({ token: "" })
        }

        // Device (ESP32)
        if (data.deviceId === undefined) {
            chrome.storage.local.set({ deviceId: "" });
        }

        if (data.deviceConnected === undefined) {
            chrome.storage.local.set({ deviceConnected: false });
        }
    }
);