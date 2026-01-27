require('dotenv').config(); // load .env
const MONGO_URI = process.env.MONGO_URI;
const MQTT_BROKER = process.env.MQTT_BROKER;


// =====================================================
// For login / register system
// =====================================================

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// =====================================================
const express = require('express');
const cors = require('cors'); // Add this line
const app = express();
const port = 8080;

app.use(cors()); // Add this line - enables CORS for all origins
app.use(express.json());

// A variable to save the current state of the system
// let focusMode = false;

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
// const mqtt = require("mqtt");
// let client_MQTT = null;

// function initializeMQTT() {
//     client_MQTT = mqtt.connect(MQTT_BROKER, {
//         username: process.env.MQTT_USER,
//         password: process.env.MQTT_PASS
//     });

//     client_MQTT.on("connect", () => {
//         console.log("MQTT connected!");
//         client_MQTT.subscribe("focus/block/extension", (err) => {
//             if (err) {
//                 console.error("MQTT subscription error:", err);
//             }
//         });
//         client_MQTT.subscribe("focus/command");
//         client_MQTT.subscribe("focus/activate");
//     });

//     client_MQTT.on("message", async (topic, message) => {
//         // message is buffer
//         console.log(message.toString());
//         const msg = message.toString();

//         if (topic === "focus/block/extension") {

//             if (msg.length < 3 || msg[1] !== "|") {
//                 console.warn("Invalid MQTT payload:", msg);
//                 return;
//             }
//             const cmd = msg[0];
//             const url = msg.slice(2);

//             switch (cmd) {
//                 case "a":
//                     // await putDocument_BLOCKED(url);
//                     break;
//                 case "d":
//                     // await removeDocument_BLOCKED(url);
//                     break;
//                 case "g":
//                     const blocked = await getAll_BLOCKED();
//                     client_MQTT.publish("focus/block/server",
//                         "s|blocklist",);

//                     blocked.forEach(link => {
//                         client_MQTT.publish("focus/block/server", `a|${link}`);
//                     });
//                     client_MQTT.publish("focus/block/server", "e|blocklist");
//                     break;
//                 case "t":
//                     const day = url.slice(0, 10);
//                     const total_time = url.slice(11);
//                     console.log(total_time);
//                     await putTotalTime(total_time, day);
//                     break;
//                 // case "s":
//                 //     if (focusMode) {
//                 //         client_MQTT.publish("focus/command", "act");
//                 //     } else {
//                 //         client_MQTT.publish("focus/command", "dact");
//                 //     }
//                 //     break;
//             }
//         }
//         /*else if (topic === "focus/command") {
//            switch (msg) {
//                case "act":
//                    focusMode = true;
//                    break;
//                case "dact":
//                    focusMode = false;
//            }
//        }*/
//         else if (topic === "focus/activate") {
//             if (msg === "d|c") {
//                 // sessioncount = sessioncount + 1;
//                 await putSessionCount(1);
//             }
//         }
//     });

//     client_MQTT.on("error", (err) => {
//         console.error("MQTT error:", err);
//     })
// }

// ==============================================================
// mongodb initialization
// ==============================================================

async function initMongo() {
    await client_MONGO.connect();
    db = client_MONGO.db("testUser");
    userCol = db.collection("users");
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

async function putDocument_BLOCKED(url, currentUser) {
    try {
        const result = await userCol.updateOne(
            { userId: currentUser, blockList: { $ne: url } },
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

async function putSessionCount(count, currentUser) {
    try {
        const dateKey = getDateKeySL();

        return await userCol.updateOne(
            { userId: currentUser },
            { $inc: { [`sessionsCompleted.${dateKey}`]: count } }
        );
    } catch (err) {
        console.error(err);
    }
}


async function removeDocument_BLOCKED(url, currentUser) {
    try {
        const res = await userCol.updateOne(
            { userId: currentUser },
            { $pull: { blockList: url } }
        );
        console.log(`${url} was removed (${res.modifiedCount} modified)`);
    } catch (err) {
        console.error("Delete error:", err);
    }
}

async function getAll_BLOCKED(currentUser) {
    try {
        const user = await userCol.findOne(
            { userId: currentUser },
            { projection: { _id: 0, blockList: 1 } }
        );
        return user ? user.blockList : [];
    } catch (err) {
        console.error("Fetch error:", err);
        return [];
    }
}

async function putTotalTime(total_time, day, currentUser) {
    try {
        const res = await userCol.updateOne(
            { userId: currentUser },
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
    // Enable JSON body parsing
    await initMongo();

    // if (process.env.MQTT_BROKER) {
    //     console.log("MQTT enabled");
    //     initializeMQTT();
    // } else {
    //     console.log("MQTT disabled (no broker configured)");
    // }



    try {
        await userCol.createIndex(
            { userId: 1 },
            { unique: true }
        );
    } catch (err) {
        if (err.code !== 11000) throw err;
        console.warn("Unique index already exists");
    }

});


// ===========================================================
// Crone job for resetting time
// ===========================================================
// const cron = require('node-cron');

// cron.schedule('59 23 * * *', async () => {
//     sendTo_extension("localhost:8080/time", "get");
// });


// ============================================
// login / register
// ============================================
app.post('/add-user', async (req, res) => {
    try {
        const { username, password, email } = req.body;

        if (!username || !password || !email) {
            return res.status(400).json({ message: "Username and password required" });
        }

        // Check if user already exists
        const existingUser = await userCol.findOne({ userId: username });
        const emailExist = await userCol.findOne({ email: email });

        if (existingUser) {
            return res.status(409).json({ message: "User already exists" });
        }
        if (emailExist) {
            return res.status(409).json({ message: "Email already used" });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user document
        const newUser = {
            userId: username,
            email: email,
            password: hashedPassword,
            blockList: [],
            total_time: {},
            sessionsCompleted: {},
            createdAt: new Date()
        };

        // Insert to mongodb
        const result = await userCol.insertOne(newUser);

        res.status(201).json({
            message: "User created successfully",
            userId: result.insertOne
        });

    } catch (err) {
        console.error("Add user error:", err);
        res.status(500).json({ message: "Internal server error" })
    }
});

app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: "Username and password required" });
        }

        // Find user
        const user = await userCol.findOne({ userId: username });
        if (!user) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        // Compare password
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        // Create JWT payload (Never include password)

        const payload = {
            userId: user.userId
        };

        const accessToken = jwt.sign(
            payload,
            process.env.TOKEN_SECRET,
            { expiresIn: "1h" }
        );

        res.json({ accessToken });
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.post("/url/add", authenticateJWT, async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ message: "url required" });

    await putDocument_BLOCKED(url, req.user.userId);
    res.json({ ok: true });
});

app.post("/url/remove", authenticateJWT, async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ message: "url required" });

    await removeDocument_BLOCKED(url, req.user.userId);
    res.json({ ok: true });
});

app.get("/url/list", authenticateJWT, async (req, res) => {
    try {
        const blockList = await getAll_BLOCKED(req.user.userId);
        res.json({ block: blockList });
    } catch (err) {
        console.error("GET /url/list error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.post("/session/complete", authenticateJWT, async (req, res) => {
    try {
        await putSessionCount(1, req.user.userId);
        res.json({ ok: true });
    } catch (err) {
        console.error("POST /session/complete error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

function authenticateJWT(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) return res.sendStatus(401);

    const token = authHeader.split(" ")[1];

    jwt.verify(token, process.env.TOKEN_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);

        req.user = user;

        next();
    });
}

// =======================================================
// =======================================================

const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 8081 });

wss.on("connection", (ws) => {
    console.log("WS connected");


    ws.isAuthenticated = false;

    ws.on("message", (data) => {
        try {
            const msg = JSON.parse(data);

            // First message must be auth
            if (msg.type === "auth") {
                jwt.verify(msg.token, process.env.TOKEN_SECRET, (err, user) => {
                    if (err) {
                        ws.send(JSON.stringify({ type: "error", message: "Auth failed" }));
                        ws.close();
                        return;
                    }

                    ws.user = user;
                    currentUser = user;
                    ws.isAuthenticated = true;
                    ws.send(JSON.stringify({ type: "auth", status: "ok" }));
                });
                return;
            }

            if (!ws.isAuthenticated) {
                ws.close();
                return;
            }

            // Normal messages
            console.log("User message:", ws.user.userId, msg);
        } catch (e) {
            ws.close();
        }
    })
})