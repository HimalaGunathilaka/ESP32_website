require('dotenv').config(); // load .env
const MONGO_URI = process.env.MONGO_URI;
const MQTT_BROKER = process.env.MQTT_BROKER;

const express = require('express');
const app = express();
const port = 8080;

// A variable to save the current state of the system
let focusMode = false;

// A variable to capture number of completed sessions
let sessioncount = 0;

const { MongoClient } = require('mongodb');

const client_MONGO = new MongoClient(MONGO_URI, {
    tlsAllowInvalidCertificates: false,
    tlsAllowInvalidHostnames: false,
    serverSelectionTimeoutMS: 30000,
});

let db, userCol;

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
        client_MQTT.subscribe("focus/block/extension", (err) => {
            if (err) {
                console.error("MQTT subscription error:", err);
            }
        });
        client_MQTT.subscribe("focus/command");
        client_MQTT.subscribe("focus/activate");
    });

    client_MQTT.on("message", async (topic, message) => {
        // message is buffer
        console.log(message.toString());
        const msg = message.toString();

        if (topic === "focus/block/extension") {

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
                    client_MQTT.publish("focus/block/server",
                        "s|blocklist",);

                    blocked.forEach(link => {
                        client_MQTT.publish("focus/block/server", `a|${link}`);
                    });
                    client_MQTT.publish("focus/block/server", "e|blocklist");
                    break;
                case "t":
                    const day = url.slice(0, 10);
                    const total_time = url.slice(11);
                    console.log(total_time);
                    await putTotalTime(total_time, day);
                    break;
                case "s":
                    if (focusMode) {
                        client_MQTT.publish("focus/command", "act");
                    } else {
                        client_MQTT.publish("focus/command", "dact");
                    }
                    break;
            }
        } else if (topic === "focus/command") {
            switch (msg) {
                case "act":
                    focusMode = true;
                    break;
                case "dact":
                    focusMode = false;
            }
        } else if (topic === "focus/activate") {
            if (msg === "d|c") {
                // sessioncount = sessioncount + 1;
                await putSessionCount(1);
            }
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
    userCol = db.collection("users");
    // Ensure the user document exists
    await userCol.updateOne(
        { userId: "himala" },
        { $setOnInsert: { userId: "himala", blockList: [], total_time: {} } },
        { upsert: true }
    );
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
        const result = await userCol.updateOne(
            { userId: "himala", blockList: { $ne: url } },
            { $addToSet: { blockList: url } }
        );
        if (result.modifiedCount > 0) {
            console.log(`${url} was submitted!`);
        } else {
            console.log(`${url} already exists`);
        }
    } catch (err) {
        console.error("Insert error:", err);
    }
}

async function putSessionCount(count) {
    try {
        const dateKey = getDateKeySL();

        return await userCol.updateOne(
            { userId: "himala" },
            { $inc: { [`sessionsCompleted.${dateKey}`]: count } }
        );
    } catch (err) {
        console.error(err);
    }
}


async function removeDocument_BLOCKED(url) {
    try {
        const res = await userCol.updateOne(
            { userId: "himala" },
            { $pull: { blockList: url } }
        );
        console.log(`${url} was removed (${res.modifiedCount} modified)`);
    } catch (err) {
        console.error("Delete error:", err);
    }
}

async function getAll_BLOCKED() {
    try {
        const user = await userCol.findOne(
            { userId: "himala" },
            { projection: { _id: 0, blockList: 1 } }
        );
        return user ? user.blockList : [];
    } catch (err) {
        console.error("Fetch error:", err);
        return [];
    }
}

async function putTotalTime(total_time, day) {
    try {
        const res = await userCol.updateOne(
            { userId: "himala" },
            { $set: { [`total_time.${day}`]: parseInt(total_time) } }
        );
        console.log(`Total time for ${day} is saved: ${total_time}`);
    } catch (err) {
        console.error("Insert Error:", err);
    }
}
// Output
/* 
[
  { url: "example.com" },
  { url: "google.com" }
]
*/

function getDateKeySL() {
    return new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Colombo"
    });
}


// ==========================================================
// Start server
// ==========================================================
app.listen(port, async () => {
    console.log(`Server listening at http://localhost:${port}`);
    await initMongo();
    initializeMQTT();

    await userCol.updateOne(
        { userId: "himala" },
        {
            $setOnInsert: {
                userId: "himala",
                blockList: [],
                total_time: {},
                sessionsCompleted: {}
            }
        },
        { upsert: true }
    );

});


// ===========================================================
// Crone job for resetting time
// ===========================================================
const cron = require('node-cron');

cron.schedule('59 23 * * *', async () => {
    client_MQTT.publish("focus/server/totalTime", "get");
    // await putSessionCount(sessioncount);
    // sessioncount = 0;
});