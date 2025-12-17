async function updateTimer() {

    const { absoluteFocusmode, total_time, start } =
        await chrome.storage.local.get([
            "absoluteFocusmode",
            "total_time",
            "start"
        ]);

    if (!absoluteFocusmode) return;

    let secs = total_time;

    if (start && start !== 0) {
        secs += Math.floor((Date.now() - start) / 1000);
    }

    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    const seconds = secs % 60;

    document.getElementById("timer").textContent =
        `${String(hours).padStart(2, "0")}:` +
        `${String(minutes).padStart(2, "0")}:` +
        `${String(seconds).padStart(2, "0")}`;

}

// Update immediately on load
updateTimer();

// Update every second
setInterval(updateTimer, 1000);

