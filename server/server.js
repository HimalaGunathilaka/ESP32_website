require('dotenv').config(); // load .env
const MONGO_URI = process.env.MONGO_URI;
const MQTT_BROKER = process.env.MQTT_BROKER;

const express = require('express');
const app = express();
const port = 8080;

const { MongoClient } = require('mongodb');

const client_MONGO = new MongoClient(MONGO_URI, {});

let db, blockCol;

// ============================================================
// MQTT
// ============================================================
const mqtt = require("mqtt");
let client_MQTT = null;

function initializeMQTT() {
    client_MQTT = mqtt.connect(MQTT_BROKER, {
        username: process.env.MQTT_USER,
        password: process.env.MQTT_PASS
    });

    client_MQTT.on("connect", () => {
        console.log("MQTT connected!");
        client_MQTT.subscribe("focus/block/receive", (err) => {
            if (err) {
                console.error("MQTT subscription error:", err);
            }
        })
    });

    client_MQTT.on("message", async (topic, message) => {
        // message is buffer
        console.log(message.toString());

        const msg = message.toString();

        if (msg.length < 3 || msg[1] !== "|") {
            console.warn("Invalid MQTT payload:", msg);
            return;
        }
        const cmd = msg[0];
        const url = msg.slice(2);

        switch (cmd) {
            case "a":
                await putDocument_BLOCKED(url);
                break;
            case "d":
                await removeDocument_BLOCKED(url);
                break;
            case "g":
                const blocked = await getAll_BLOCKED();
                client_MQTT.publish("focus/block/send",
                    "s|blocklist",);

                blocked.forEach(link => {
                    client_MQTT.publish("focus/block/send", `a|${link}`);
                });
                client_MQTT.publish("focus/block/send", "e|blocklist");
                break;
        }

    });

    client_MQTT.on("error", (err) => {
        console.error("MQTT error:", err);
    })
}

// +++++++++++++++++++++++++++++++++++++++++++++++++++++++++

async function initMongo() {
    await client_MONGO.connect();
    db = client_MONGO.db("testUser");
    blockCol = db.collection("blockList");
    await blockCol.createIndex({ url: 1 }, { unique: true });
    console.log("MongoDB connected!");
}

// ==========================================================
// Routes
// ==========================================================

app.get('/', (req, res) => {
    res.send('Hello from EXPRESS!');
});


// =========================================================
// mongoDB requests
// =========================================================

async function putDocument_BLOCKED(url) {

    try {
        await blockCol.insertOne({ url: url });
        console.log(`${url} was submitted!`);
    } catch (err) {
        if (err.code === 11000) {
            console.log(`${url} already exist`);
        } else {
            console.error("Insert error:", err);
        }
    }
}

async function removeDocument_BLOCKED(url) {
    try {
        const res = await blockCol.deleteMany({ url: url });
        console.log(`${url} was removed (${res.deletedCount})`)
    } catch (err) {
        console.error("Delete error:", err);
    }
}

async function getAll_BLOCKED() {
    try {
        const docs = await blockCol
            .find({}, { projection: { _id: 0, url: 1 } }
            ).toArray();
        return docs.map(docs => docs.url);
    } catch (err) {
        console.error("Fetch error:", err);
        return [];
    }
}
// Output
/* 
[
  { url: "example.com" },
  { url: "google.com" }
]
*/



// ==========================================================
// Start server
// ==========================================================
app.listen(port, async () => {
    console.log(`Server listening at http://localhost:${port}`);
    await initMongo();
    initializeMQTT();
});
