const log = (msg) => {
    document.getElementById("log").textContent += msg + "\n";
};

// MQTT client variable in outer scope
let client = null;

function initializeMQTT() {
    client = new Paho.MQTT.Client(
        "localhost",
        9001,
        "ext-client-" + Math.random()
    );

    client.onConnectionLost = (res) => {
        log("Lost: " + res.errorMessage);
    };

    client.onMessageArrived = (msg) => {
        log("Received: " + msg.payloadString);
    };

    client.connect({
        userName: "himala",
        password: "123",
        onSuccess: () => {
            log("Connected");
            client.subscribe("test/topic");
        },
        onFailure: (err) => {
            log("Failed: " + err.errorMessage);
        }
    });
}

// Attach listener after page loads
document.getElementById("connect").addEventListener("click", () => {
    if (!client || !client.isConnected()) {
        log("Not connected yet!");
        return;
    }
    const m = new Paho.MQTT.Message("Hello from extension");
    m.destinationName = "test/topic";
    client.send(m);
});


initializeMQTT();