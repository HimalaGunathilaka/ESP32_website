let focusMode = false;

// -------------------- Toggle focus --------------------
async function focus() {
  // Always read current storage value to avoid sync issues
  const { focusMode: current } = await chrome.storage.local.get("focusMode");
  console.log("Current focusMode:", current, "-> Setting to:", !current);
  chrome.storage.local.set({ focusMode: !current });
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
  const iconContainer = document.getElementById("iconList");
  
  // Read SYSTEM TRUTH
  chrome.storage.local.get("absoluteFocusmode", (data) => {
    const active = data.absoluteFocusmode ?? false;
    focusMode = active;
    btn.classList.toggle("active", active);
    btn.textContent = btn.classList.contains("active") ? "Focusing..." : "Focus";

    const circle = document.getElementById("progressCircle");
    if (circle) {
      circle.classList.toggle("active", active);
    }
  });
  
  // React to changes (popup stays in sync)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.absoluteFocusmode) return;

    focusMode = changes.absoluteFocusmode.newValue;
    btn.classList.toggle("active", focusMode);
    btn.textContent = btn.classList.contains("active") ? "Focusing..." : "Focus";

    const circle = document.getElementById("progressCircle");
    if (circle) {
      circle.classList.toggle("active", focusMode);
    }

    if (!focusMode) {
      displayImage(false);
    }
  });

  btn.addEventListener("click", () => {
    focus(); // request change only
  });

  

  chrome.storage.local.get("block", (data) => {
    const blocked = data.block ?? [];

    // Toggle button state
    addBtn.classList.toggle("tag", blocked.includes(hostname));

    // Render icons
    renderBlockedIcons(blocked, iconContainer);
  });
  
  addBtn.addEventListener("click", async () => {
    const hostname = await getActiveHostname();
    if (!hostname) return;

    console.log("Website entered:", hostname);
    
    chrome.storage.local.get("block", (data) => {
      const blocked = data.block ?? [];

      if (!blocked.includes(hostname) ) {
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
      
      // Re-render icons
      renderBlockedIcons(blocked, iconContainer);
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

// ++++++++++++++++++++++++++++++++++++++++++++++
// This part has the circular progress bar as well
// ++++++++++++++++++++++++++++++++++++++++++++++
function renderTime(secs) {
  const hours = Math.floor(secs / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  const seconds = secs % 60;

  document.getElementById("timer").textContent =
    `${String(hours).padStart(2, "0")}:` +
    `${String(minutes).padStart(2, "0")}`;
    
  // Update circular progress bar (max 8 hours)
  const maxTime = 8 * 60 * 60; // 8 hours in seconds
  const progress = Math.min(secs / maxTime, 1); // Cap at 100%
  const circumference = 534.07;
  const offset = circumference * (1 - progress);

  const circle = document.getElementById("progressCircle");
  if (circle) {
    circle.style.strokeDashoffset = offset;
  }
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


// // +++++++++++++++++++++++++++++++++++++++++++++
// // Render icons of the websites in blocked list
// // +++++++++++++++++++++++++++++++++++++++++++++
function renderBlockedIcons(blocked, container) {
  container.innerHTML = "";
  
  blocked.forEach(site => {
    const img = document.createElement("img");
    img.src = `https://www.google.com/s2/favicons?sz=64&domain=${site}`;
    img.alt = site;
    img.title = site;
    img.width = 32;
    img.height = 32;
    container.appendChild(img);
  });
}