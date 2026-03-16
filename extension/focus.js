/**
 * @fileoverview Manages the focus timer display for the focus page.
 */


/**
 * Get the number of sessions from local storage.
 */
async function updateTimer() {
  const { absoluteFocusMode, sessionCount = 0, sessionTime } =
    await chrome.storage.local.get([
      "absoluteFocusMode",
      "sessionCount",
      "sessionTime"
    ]);

  if (absoluteFocusMode) {
    mins = sessionCount * sessionTime;
    renderTime(mins);
  }
}

/**
 * 
 * @param {BigInteger} mins 
 */
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

