// -------------------- Init storage safely --------------------
chrome.storage.local.get(
    ["focusMode", "total_time", "absoluteFocusmode",
        "start", "block", "command", "urlMutex",
        "sessionComplete", "sessionCompleteIndicator", "sessionTime",
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

        if (data.sessionTime === undefined) {
            chrome.storage.local.set({
                sessionTime: 1 // In minutes
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