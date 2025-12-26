let focusMode = false;

// -------------------- Toggle focus --------------------
async function focus() {
  chrome.storage.local.set({ focusMode: !focusMode });
  // console.log("Pressed!")
  // console.log("Focus value:", focusMode)
}

// Display image only when try to deactivate focus while in cool off
function displayImage(show) {
  const img = document.getElementById("pict");
  img.style.display = show ? "block" : "none";
}

// -----Get hostname of active tab-----------
async function getActiveHostname() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tabs[0]?.url;
  if (!url) return null;

  return new URL(url).hostname;
}

// -------------------- Init popup --------------------
document.addEventListener("DOMContentLoaded", async () => {
  const btn = document.getElementById("focusBtn");
  const addBtn = document.getElementById("addBtn");
  const hostname = await getActiveHostname();

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
    focus(); // request change only
  });



  chrome.storage.local.get("block", (data) => {
    const blocked = data.block ?? [];

    if (blocked.includes(hostname)) {
      addBtn.classList.toggle("tag", true);
    } else {
      addBtn.classList.toggle("tag", false);
    }
  })

  addBtn.addEventListener("click", async () => {
    const hostname = await getActiveHostname();
    if (!hostname) return;

    console.log("Website entered:", hostname);

    chrome.storage.local.get("block", (data) => {
      const blocked = data.block ?? [];

      if (!blocked.includes(hostname)) {
        blocked.push(hostname);
        chrome.storage.local.set({ block: blocked }, () => {
          console.log("Updated block list:", blocked);
        });
        addBtn.classList.toggle("tag", true);
      } else {
        const index = blocked.indexOf(hostname);
        blocked.splice(index, 1);
        chrome.storage.local.set({ block: blocked }, () => {
          console.log("Removed from block list:", blocked);
        });
        addBtn.classList.toggle("tag", false);
      }
    });

  });
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
