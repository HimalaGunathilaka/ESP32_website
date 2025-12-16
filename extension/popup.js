let focusMode = false;
let startWith = 0;

// -------------------- Toggle focus --------------------
function focus() {
  chrome.storage.local.set({ focusMode: !focusMode });
}

// -------------------- Init popup --------------------
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("focusBtn");

  // Read SYSTEM TRUTH
  chrome.storage.local.get("absoluteFocusmode", (data) => {
    const active = data.absoluteFocusmode ?? false;
    focusMode = active;
    btn.classList.toggle("active", active);
  });

  // React to changes (popup stays in sync)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.absoluteFocusmode) return;

    focusMode = changes.absoluteFocusmode.newValue;
    btn.classList.toggle("active", focusMode);
  });

  btn.addEventListener("click", focus);
});

// -------------------- Timer (UI only) --------------------
function updateTimer() {
  const hours = Math.floor(startWith / 3600);
  const minutes = Math.floor((startWith % 3600) / 60);
  const seconds = startWith % 60;

  document.getElementById("timer").textContent =
    `${String(hours).padStart(2, "0")}:` +
    `${String(minutes).padStart(2, "0")}:` +
    `${String(seconds).padStart(2, "0")}`;

  startWith++;
}

updateTimer();
setInterval(updateTimer, 1000);
