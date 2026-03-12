
// -------------------- Reactive observer --------------------
chrome.storage.onChanged.addListener(async (changes, area) => {
    const { username } = await chrome.storage.local.get("username");

    // console.log("Start of observer");
    if (area !== "local") return;

    const abs = await chrome.storage.local.get("absoluteFocusmode");

    if (changes.isLogged) {
        if (changes.isLogged.newValue) {
            chrome.storage.local.set({ date: new Date() });
            initializeMQTT();
            chrome.alarms.create("mqttPing", { periodInMinutes: 0.5 });

            const id = await fetchDeviceId();
            if (id) {
                chrome.storage.local.set({ deviceId: id });
            }

        } else {
            // disconnect mqtt
            client.end(false, () => {
                console.log('MQTT client disconnected gracefully');
            });
        }
    }

    if (changes.username && changes.username !== "Guest") {
        const data = await sendTo_server("GET", "/url/list");

        if (data && data.block) {
            // Mark this as server-originated to prevent republishing
            await chrome.storage.local.set({
                urlMutex: "mqtt",
                block: data.block
            });
            console.log("Block list updated:", data.block);
        }
    }

    if (changes.block) {
        handleTabChange_icon();

        const { urlMutex } = await chrome.storage.local.get("urlMutex");

        if (urlMutex === "mqtt") {
            // This change came from MQTT, don't republish (prevents echo loop)
            await chrome.storage.local.set({ urlMutex: "none" });
        } else if (client && client.connected) {
            // This change is local, publish it to MQTT
            await chrome.storage.local.set({ urlMutex: "local" }); // Mark as local-originated
            const oldArr = changes.block.oldValue || [];
            const newArr = changes.block.newValue || [];

            const lenOld = oldArr.length;
            const lenNew = newArr.length;

            // publish the changes
            if (lenOld < lenNew) {
                for (let i = lenOld; i < lenNew; i++) {
                    const msgURL = `a|${newArr[i]}`;
                    const destinationTopic = `${username}/focus/block/extension`;
                    client.publish(destinationTopic, msgURL);
                    console.log("Added");
                }
            } else {
                for (let i = lenNew; i < lenOld; i++) {
                    const msgURL = `d|${oldArr[i]}`;
                    const destinationName = `${username}/focus/block/extension`;
                    client.publish(destinationName, msgURL);
                    console.log("Removed");
                }
            }
        }
        if (abs.absoluteFocusmode) await redirectCurrentTab();
    }

    if (changes.absoluteFocusmode) {
        const isEnabled = changes.absoluteFocusmode.newValue;
        if (isEnabled === true) {
            const { sessionTime } = await chrome.storage.local.get("sessionTime");

            chrome.alarms.create("focusSessionEnd", { delayInMinutes: sessionTime });
        } else {
            const { sessionComplete } = await chrome.storage.local.get("sessionComplete");
            if (!sessionComplete) {
                chrome.alarms.clear("focusSessionEnd");
            }
        }
    }

    if (!changes.focusMode) return;

    const newFocus = changes.focusMode.newValue;
    const { start } = await chrome.storage.local.get("start");
    const { focusSource } = await chrome.storage.local.get("focusSource");
    const { sessionCount } = await chrome.storage.local.get("sessionCount");

    if (newFocus && !abs.absoluteFocusmode) {

        if (start === 0) {
            await chrome.storage.local.set({
                start: Date.now(),
                date: new Date().toISOString().split('T')[0]
            })
        }

        const { block = [] } = await chrome.storage.local.get("block");

        await enableRedirectRules(block);
        await redirectCurrentTab(block);
        await chrome.storage.local.set({ absoluteFocusmode: true });


        if (client && client.connected) {
            const msg = `a|${sessionCount}`;
            const destinationName = `${username}/focus/activate`;
            client.publish(destinationName, msg, { retain: true });
            await chrome.storage.local.set({ source: true });
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
        await chrome.storage.local.set({
            absoluteFocusmode: false,
            focusMode: false
        });

        // await elapsedSeconds();

        // console.log("Focus mode OFF");

        if (client && client.connected) {

            const { sessionComplete } = await chrome.storage.local.get("sessionComplete");

            if (sessionComplete && sessionSrc) {
                chrome.storage.local.set({ sessionComplete: false });
                sessionSrc = false;

                // If this was already received no need to publish it again
                // if (focusSource === "mqtt") return;

                const msg = `d|c|${sessionCount}`;
                const destinationName = `${username}/focus/activate`;
                client.publish(destinationName, msg, { retain: true });
            } else {
                // If this was already received no need to publish it again
                // if (focusSource === "mqtt") return;

                // chrome.storage.local.get(["total_time"], (data) => {
                //     const totalTime = data.total_time ?? 0;
                //     // Flag to deactivate `d` and total focus time is being sent. 
                //     // Client id is not used
                // });

                const msg = `d|n|${sessionCount}`;
                const destinationName = `${username}/focus/activate`;
                client.publish(destinationName, msg, { retain: true });
            }
        }
    }
});


