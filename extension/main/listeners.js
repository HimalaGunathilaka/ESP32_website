
// -------------------- Reactive observer --------------------
chrome.storage.onChanged.addListener(async (changes, area) => {
    // console.log("Start of observer");
    if (area !== "local") return;

    const abs = await chrome.storage.local.get("absoluteFocusmode");

    if (changes.isLogged) {
        if (changes.isLogged.newValue) {
            initializeMQTT();
            chrome.alarms.create("mqttPing", { periodInMinutes: 0.5 });

            const id = await fetchDeviceId();
            if (id) {
                chrome.storage.local.set({ deviceId: id });
            }

        }
    }

    if (changes.username && changes.username !== "Guest") {
        const data = await sendTo_server("GET", "/url/list");

        if (data && data.block) {
            // Mark this as server-originated to prevent republishing
            await chrome.storage.local.set({ urlMutex: "mqtt" });
            await chrome.storage.local.set({ block: data.block });
            console.log("Block list updated:", data.block);
        }
    }

    if (changes.block) {
        handleTabChange_icon();

        const { urlMutex } = await chrome.storage.local.get("urlMutex");

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

                    console.log("Added")

                    // sendTo_server("POST", "/url/add", { url: newArr[i] });
                }
            } else {
                for (let i = lenNew; i < lenOld; i++) {
                    const msgURL = new Paho.MQTT.Message(`d|${oldArr[i]}`);
                    msgURL.destinationName = "focus/block/extension";
                    client.send(msgURL);

                    console.log("Removed")
                    // sendTo_server("POST", "/url/remove", { url: oldArr[i] });
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
            const { sessionTime } = await chrome.storage.local.get("sessionTime");
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
                msg.destinationName = "focus/activate";
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


