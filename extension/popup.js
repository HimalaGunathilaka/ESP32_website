let focusMode = false;

// -------------------- Toggle focus --------------------
function focus() {
  chrome.storage.local.set({ focusMode: !focusMode });
  // console.log("Pressed!")
  // console.log("Focus value:", focusMode)
}

// Display image only when try to deactivate focus while in cool off
function displayImage(show) {
  const img = document.getElementById("pict");
  img.style.display = show ? "block" : "none";
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

    if (!focusMode) {
      displayImage(false);
    }
  });

  btn.addEventListener("click", () => {
    focus();

    chrome.storage.local.get("absoluteFocusmode", (data) => {
      console.log("abs Focus:", data.absoluteFocusmode)
      displayImage(data.absoluteFocusmode === true);
    });
  });

});

document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("websiteInput");
  const addBtn = document.getElementById("addBtn");

  addBtn.addEventListener("click", () => {
    addBtn.addEventListener("click", () => {
      const value = input.value.trim();

      if (!value) return;

      console.log("Website entered:", value);

      chrome.storage.local.get("block", (data) => {
        const blocked = data.block ?? [];
        const lowercasedValue = value.toLowerCase();
        if (!blocked.includes(lowercasedValue)) {
          blocked.push(lowercasedValue);
          chrome.storage.local.set({ block: blocked });
          console.log("Updated block list:");
        }
        console.log("Already present");
      })
    })
  })
})


// -------------------- Timer (UI only) --------------------
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


updateTimer();
setInterval(updateTimer, 1000);



// ---------------------Reactive observer----------------------
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;

  // Only react when focusMode changes
  if (!changes.focusMode) return;

  // Only when focusMode is turned ON
  if (changes.focusMode.newValue !== true) return;

  // Check current absoluteFocusmode
  chrome.storage.local.get("absoluteFocusmode", ({ absoluteFocusmode }) => {
    if (absoluteFocusmode === true) {
      displayImage(true);
    }
  });
});
