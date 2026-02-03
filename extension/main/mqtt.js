// ======================================================
let client = null;
let pendingBlockList = []; // Accumulator for incoming block list from server
let sessionSrc = false;

async function initializeMQTT() {
    try {
        const { isLogged } = await chrome.storage.local.get("isLogged");
        // const { sessionTime } = await chrome.storage.local.get("sessionTime");
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
                const { isSource } = await chrome.storage.local.get("source");
                const { sessionCount } = await chrome.storage.local.get("sessionCount");
                let count_recived = 0;

                let send_back = null;

                // If this is the source of activation. 
                // No point of listening to the signal they sent.

                if (isSource) { return; }

                // if (payload === "activate") {
                // }
                // else if (payload === "deactivate") {
                //     await chrome.storage.local.set({ focusSource: "mqtt" });
                //     await chrome.storage.local.set({ focusMode: false });
                // }

                if (payload.startsWith("a|")) {
                    count_recived = parseInt(payload.split("|")[1]);
                    await chrome.storage.local.set({ focusSource: "mqtt" });
                    await chrome.storage.local.set({ focusMode: true });

                    if (count_recived < sessionCount) {
                        // Our count is higher, send it back
                        send_back = new Paho.MQTT.Message(`a|${sessionCount}`);
                    } else if (count_recived > sessionCount) {
                        // Their count is higher, update ours
                        await chrome.storage.local.set({ sessionCount: count_recived });
                    }
                    // If equal, do nothing
                }
                else if (payload.startsWith("d|")) {
                    count_recived = parseInt(payload.split("|")[2]);

                    await chrome.storage.local.set({ focusSource: "mqtt" });
                    await chrome.storage.local.set({ focusMode: false });

                    if (payload.startsWith("d|n")) {
                        if (count_recived < sessionCount) {
                            send_back = new Paho.MQTT.Message(`d|n|${sessionCount}`);
                        } else if (count_recived > sessionCount) {
                            await chrome.storage.local.set({ sessionCount: count_recived });
                        }
                        return;
                    } else if (payload.startsWith("d|c")) {
                        sessionSrc = false;
                        if (count_recived < sessionCount) {
                            send_back = new Paho.MQTT.Message(`d|c|${sessionCount}`);
                        } else if (count_recived > sessionCount) {
                            await chrome.storage.local.set({ sessionCount: count_recived });
                        }
                    }


                }

                if (send_back) {
                    send_back.destinationName = "focus/activate";
                    send_back.retained = true;
                    client.send(send_back);
                }
                break;
            case "focus/block/extension": {
                const { urlMutex } = await chrome.storage.local.get("urlMutex");

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
            case "esp/status": {
                if (payload === "offline") {
                    await chrome.storage.local.set({ deviceConnected: false });
                } else if (payload === "online") {
                    await chrome.storage.local.set({ deviceConnected: true });
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
                client.subscribe("esp/status");

                const { deviceId } = await chrome.storage.local.get("deviceId");
                if (deviceId !== "") {
                    const id = await fetchDeviceId();
                    if (id) {
                        chrome.storage.local.set({ deviceId: id });
                    }
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
            onFailure: (err) => {
                console.warn("MQTT connection failed (will retry):", err);
                setTimeout(initializeMQTT, 2000);
            },
        });
    } catch (err) {
        console.error("MQTT initialization error (non-blocking):", err);
        // Don't retry on initialization errors, only on connection failures
    }
}