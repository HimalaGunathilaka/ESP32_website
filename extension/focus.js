let elapsedSeconds = 0;

document.addEventListener("DOMContentLoaded", () => {
    chrome.storage.local.get(["total_time"], (result) => {
        if (result.total_time !== undefined) {
            elapsedSeconds = result.total_time;
        }
        // console.log(result.total_time);
    });
});

function updateTimer() {
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