// --------------------------------------------
async function sendTo_server(method, endpoint, payload) {
    try {
        const { token, isLogged } = await chrome.storage.local.get([
            "token",
            "isLogged"
        ]);

        if (!isLogged || !token) {
            console.warn("Not logged in -> skipping server sync");
            return null;
        }

        const res = await fetch(`${SERVER_BASE}${endpoint}`, {
            method: method,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: method !== "GET" ? JSON.stringify(
                typeof payload === "string"
                    ? { value: payload }
                    : payload
            ) : undefined
        });

        if (res.status === 401) {
            console.warn("JWT expired or invalid");
            await chrome.storage.local.set({ isLogged: false });
            return null;
        }

        if (!res.ok) {
            console.error("Server error:", await res.text());
            return null;
        }

        // Capture response form GET requests
        if (method === "GET") {
            const data = await res.json();
            return data;
        }

        return true;
    } catch (err) {
        console.error("sendTo_server failed:", err);

        // If we can't reach the server and the user was logged in, log them out
        if (method === "GET" && endpoint === "/auth/verify") {
            console.warn("Server unreachable - logging out user");
            await chrome.storage.local.set({ username: "Guest" });
            await chrome.storage.local.set({ isLogged: false });
        }

        return null;
    }
}