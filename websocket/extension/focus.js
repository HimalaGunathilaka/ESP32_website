async function updateTimer() {
  const { absoluteFocusmode, total_time = 0, start = 0 } =
    await chrome.storage.local.get([
      "absoluteFocusmode",
      "total_time",
      "start"
    ]);

  let secs = total_time;

  if (absoluteFocusmode && start) {
    secs += Math.floor((Date.now() - start) / 1000);
  }

  renderTime(secs);
}

function renderTime(secs) {
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

