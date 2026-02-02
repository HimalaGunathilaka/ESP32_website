require('dotenv').config(); // load .env
const MONGO_URI = process.env.MONGO_URI;


const {
    putDevice_id,
    getDevice_id,
    putDocument_BLOCKED,
    putSessionCount,
    removeDocument_BLOCKED,
    getAll_BLOCKED,
    putTotalTime,
    getDateKeySL,
    setUserCollection
} = require('./serverModules/mongo_calls.js');

const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger");


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

app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec)
);


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


async function initMongo() {
    await client_MONGO.connect();
    db = client_MONGO.db("testUser");
    userCol = db.collection("users");

    setUserCollection(userCol);
    console.log("MongoDB connected!");
}

// ==========================================================
// Routes
// ==========================================================

app.get('/', (req, res) => {
    res.send('Hello from EXPRESS!');
});


// ==========================================================
// Start server
// ==========================================================
app.listen(port, async () => {
    console.log(`Server listening at http://localhost:${port}`);
    // Enable JSON body parsing
    await initMongo();

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
            deviceId: "",
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
            { expiresIn: "1m" }
        );

        res.json({ accessToken });
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// ===============================
// Other Websockets 
// ===============================

app.post("/device/put", authenticateJWT, async (req, res) => {
    const { deviceId } = req.body;
    if (!deviceId) {
        return res.status(400).json({ message: "deviceId required" });
    }

    await putDevice_id(deviceId, req.user.userId);
    res.json({ ok: true });
});

app.get("/device/get", authenticateJWT, async (req, res) => {
    const deviceId = await getDevice_id(req.user.userId);
    res.json({ deviceId });
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

app.post("/time/total", authenticateJWT, async (req, res) => {
    try {
        await putTotalTime(req.user.total_time);
        res.json({ ok: true });
    } catch (err) {
        console.error("POST /time/total error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
})

app.get("/auth/verify", authenticateJWT, (req, res) => {
    res.json({ ok: true, userId: req.user.userId });
});

function authenticateJWT(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) return res.status(401).json({ message: "No token provided" });

    const token = authHeader.split(" ")[1];

    jwt.verify(token, process.env.TOKEN_SECRET, (err, user) => {
        if (err) {
            if (err.name === "TokenExpiredError") {
                return res.status(401).json({ message: "Token expired" });
            } else {
                return res.status(403).json({ message: "Invalid token" });
            }
        }

        req.user = user;
        next();
    });
}
