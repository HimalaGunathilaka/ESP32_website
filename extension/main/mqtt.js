// ======================================================
let client = null;

const MQTT_BROKER_LOCATION = "localhost";
const PORT = 9001;

async function initializeMQTT() {
    const { username } = await chrome.storage.local.get("username");
    if (!username) return; // stop if no username stored

    try {
        const { isLogged } = await chrome.storage.local.get("isLogged");
        if (!isLogged) return;

        // Construct WebSocket URL for browser
        const url = `ws://${MQTT_BROKER_LOCATION}:${PORT}/mqtt`;

        const options = {
            clean: true,
            reconnectPeriod: 2000, // Reconnect in 2 seconds
            connectTimeout: 4000,
            clientId: "worker-" + crypto.randomUUID(),
            username: "himala",
            password: "123"
        };

        client = mqtt.connect(url, options);

        // MQTT event handlers
        client.on('connect', async () => {
            console.log("MQTT connected");

            try {
                // Subscribe to user topics
                client.subscribe(`${username}/focus/#`);

                // Device ID management
                const { deviceId } = await chrome.storage.local.get("deviceId");
                if (!deviceId) {
                    const result = await sendTo_server("GET", "/device/get");
                    if (result) await chrome.storage.local.set({ deviceId: result });
                }

                // Initial fetch for block list from server
                const data = await sendTo_server("GET", "/url/list");
                if (data && data.block) {
                    await chrome.storage.local.set({
                        urlMutex: "mqtt",
                        block: data.block
                    });
                    console.log("Block list updated:", data.block);
                }

            } catch (err) {
                console.error("MQTT connect handler error:", err);
                setTimeout(initializeMQTT, 2000); // retry after 2s
            }
        });

        client.on('message', async (topic, payload) => {
            payload = payload.toString(); // ensure string
            const { sessionCount } = await chrome.storage.local.get("sessionCount");

            switch (topic) {
                // ===== FOCUS ACTIVATE / DEACTIVATE =====
                case `${username}/focus/activate`:
                    let send_back = null;

                    if (payload.startsWith("a|")) {
                        const count_received = parseInt(payload.split("|")[1]);
                        await chrome.storage.local.set({ focusSource: "mqtt", focusMode: true });

                        if (count_received < sessionCount) {
                            send_back = `${sessionCount}`;
                        } else if (count_received > sessionCount) {
                            await chrome.storage.local.set({ sessionCount: count_received });
                        }

                    } else if (payload.startsWith("d|")) {
                        const count_received = parseInt(payload.split("|")[2]);
                        await chrome.storage.local.set({ focusSource: "mqtt", focusMode: false });

                        if (payload.startsWith("d|n") || payload.startsWith("d|c")) {
                            if (count_received < sessionCount) {
                                send_back = `${sessionCount}`;
                            } else if (count_received > sessionCount) {
                                await chrome.storage.local.set({ sessionCount: count_received });
                            }
                        }
                    }

                    if (send_back) {
                        const destinationName = `${username}/focus/count`;
                        client.publish(destinationName, send_back);
                    }
                    break;

                // ===== FOCUS COUNT =====
                case `${username}/focus/count`:
                    const receivedCount = parseInt(payload);
                    if (receivedCount > sessionCount) {
                        await chrome.storage.local.set({ sessionCount: receivedCount });
                    } else if (receivedCount < sessionCount) {
                        client.publish(`${username}/focus/count`, `${sessionCount}`);
                    }
                    break;

                // ===== BLOCK LIST =====
                case `${username}/focus/block/extension`:
                    const { urlMutex } = await chrome.storage.local.get("urlMutex");

                    if (urlMutex === "local") {
                        await chrome.storage.local.set({ urlMutex: "none" });
                    } else {
                        const result = await chrome.storage.local.get("block");
                        const block = result.block || [];
                        const event = payload[0];
                        const url = payload.slice(2);

                        const urlExists = block.includes(url);

                        if (event === 'a' && !urlExists) {
                            block.push(url);
                            await chrome.storage.local.set({ urlMutex: "mqtt", block });
                        } else if (event === 'd' && urlExists) {
                            const index = block.indexOf(url);
                            block.splice(index, 1);
                            await chrome.storage.local.set({ urlMutex: "mqtt", block });
                        }
                    }
                    break;

                default:
                    console.log("Unhandled topic:", topic, payload);
            }
        });

        client.on('error', (err) => {
            console.error("MQTT error:", err);
        });

        client.on('close', () => {
            console.log("MQTT disconnected, retrying in 2s");
            setTimeout(initializeMQTT, 2000);
        });

    } catch (err) {
        console.error("MQTT initialization error:", err);
    }
}