// Login elements
const loginBox = document.getElementById("login");
const loginBtn = loginBox.querySelector("button");
const loginInputs = loginBox.querySelectorAll("input");

// Register elements
const registerBox = document.getElementById("register");
const registerBtn = registerBox.querySelector("button");
const registerInputs = registerBox.querySelectorAll("input");


let socket = null;


document.addEventListener("DOMContentLoaded", () => {

    // Login logic
    loginBtn.addEventListener("click", async () => {
        const username = loginInputs[0].value.trim();
        const password = loginInputs[1].value.trim();

        if (!username || !password) {
            showMessage("Please fill in all login fields", "error");
            return;
        }

        try {
            const res = await fetch("http://localhost:8080/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();

            if (!res.ok) {
                showMessage(data.message || "Login failed", "error");
                return; // Add return here to prevent showing success message
            }
            showMessage("Login successful");

            
            await chrome.storage.local.set({
                username,
                token: data.accessToken,
                isLogged: true
            });

            console.log("Complete");
        } catch (err) {
            showMessage("Server is not running", "error");
            return
        }



    });

    // Register logic
    registerBtn.addEventListener("click", async () => {

        const username = registerInputs[0].value.trim();
        const email = registerInputs[1].value.trim();
        const password = registerInputs[2].value.trim();
        const confirmPassword = registerInputs[3].value.trim();

        if (!username || !email || !password || !confirmPassword) {
            showMessage("Please fill in all register fields");
            return;
        }

        if (password !== confirmPassword) {
            showMessage("Passwords do not match");
            return;
        }

        try {
            const res = await fetch("http://localhost:8080/add-user", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password, email })
            });
            const data = await res.json();

            if (!res.ok) {
                showMessage(data.message || "Registration failed", "error");
                return;
            }

            showMessage("Registration successful. Please log in.");

        } catch (err) {
            showMessage("Server is not running", "error");
        }
    });
});

document.addEventListener("DOMContentLoaded", async () => {

    const { isLogged, token } = await chrome.storage.local.get([
        "isLogged",
        "token"
    ]);

    if (isLogged && token) {
        // user is already logged in
        connectWebsocket(token);
    }

    // ALWAYS attach listeners
});



const message = document.getElementById("message");

function showMessage(text, type = "success") {
    message.textContent = text;
    message.className = type;
    message.style.display = "block";

    setTimeout(() => {
        message.style.display = "none";
    }, 2500);
}


function connectWebsocket(token) {
    socket = new WebSocket("ws://localhost:8081");

    socket.addEventListener("open", () => {
        socket.send(JSON.stringify({
            type: "auth",
            token
        }));
    });

    socket.addEventListener("message", (event) => {
        const msg = JSON.parse(event.data);

        if (msg.type === "auth" && msg.status === "ok") {
            console.log("Websocket authenticated");
        }
    });

    socket.addEventListener("close", () => {
        console.log("Websocket closed")
    })
}