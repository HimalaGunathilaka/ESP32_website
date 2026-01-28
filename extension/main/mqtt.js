
// ======================================================
// ======================================================
// MQTT
// ======================================================
// ======================================================
let client = null;
let pendingBlockList = []; // Accumulator for incoming block list from server
let sessionSrc = false;

async function initializeMQTT() {
    const { isLogged } = await chrome.storage.local.get("isLogged");
    await chrome.storage.local.set({ deviceConnected: false });

    if (!isLogged) return;

    client = new Paho.MQTT.Client("localhost", 9001, "worker-" + crypto.randomUUID());

    chrome.alarms.onAlarm.addListener(() => {
        if (!client || !client.isConnected());
    });

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

                    if (payload == "d|c") {
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
            case "esp/connected": {
                if (payload === "yes") {
                    await chrome.storage.local.set({ deviceConnected: true });
                } else if (payload === "no") {
                    const result = sendTo_server("GET", "/device/get");
                    if (result) {
                        await chrome.storage.local.set({ deviceId: result });
                    }
                }
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
                client.subscribe("esp/connected");

                // Fetch the state of focus from server
                // const fetchState = new Paho.MQTT.Message("s|----");
                // fetchState.destinationName = "focus/block/extension";
                // client.send(fetchState);

                const { deviceId } = await chrome.storage.local.get("deviceId");
                if (deviceId !== "") {
                    const isDeviceConnected = new Paho.MQTT.Message(`check|${deviceId}`);
                    isDeviceConnected.destinationName = "esp/connected";
                    client.send(isDeviceConnected);
                } else {
                    const result = await sendTo_server("GET", "/device/get");
                    if (result) {
                        await chrome.storage.local.set({ deviceId: result });
                    }
                }


                // +++++++++++++++++++++++++++++++++++++++++++++++++++
                // Initial fetch for the block list from mongodb
                // +++++++++++++++++++++++++++++++++++++++++++++++++++
                // Set flags to indicate we're loading (don't clear block list yet)

                const data = await sendTo_server("GET", "/url/list");

                if (data && data.block) {
                    // Mark this as server-originated to prevent republishing
                    await chrome.storage.local.set({ urlMutex: "mqtt" });
                    await chrome.storage.local.set({ block: data.block });
                    console.log("Block list updated:", data.block);
                }
            } catch (err) {
                console.error("MQTT onSuccess error:", err);
                setTimeout(initializeMQTT, 2000);
            }

        },
        onFailure: () => setTimeout(initializeMQTT, 2000),
    });
}