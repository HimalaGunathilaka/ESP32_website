let elapsedSeconds = 0;

// Fetch total focus time from storage
chrome.storage.local.get("total_time", (result) => {
    if (result.total_time !== undefined) {
        elapsedSeconds = result.total_time;
    }
});

function updateTimer() {

    // Fetching total focus time

    const hours = Math.floor(elapsedSeconds / 3600);
    const minutes = Math.floor((elapsedSeconds % 3600) / 60);
    const seconds = elapsedSeconds % 60;

    const formattedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    document.getElementById('timer').textContent = formattedTime;

    elapsedSeconds++;
}

// Update immediately on load
updateTimer();

// Update every second
setInterval(updateTimer, 1000);