async function updateTimer() {
  const { absoluteFocusmode, sessionCount = 0, sessionTime } =
    await chrome.storage.local.get([
      "absoluteFocusmode",
      "sessionCount",
      "sessionTime"
      // "total_time",
      // "start"
    ]);

  let secs = 0;

  if (absoluteFocusmode) {
    mins = sessionCount * sessionTime;
    renderTime(mins);
  }

}

function renderTime(mins) {
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;

  document.getElementById("timer").textContent =
    `${String(hours).padStart(2, "0")} h:` +
    `${String(minutes).padStart(2, "0")} min`;
}


// Update immediately on load
updateTimer();

// Update every second
setInterval(updateTimer, 1000);

