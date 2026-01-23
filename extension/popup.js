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

// HTML objects

const addBtn = document.getElementById("addBtn");
const btn = document.getElementById("focusBtn");
const iconContainer = document.getElementById("iconList");
const tooltip = document.getElementById("addTooltip");
const userBtn = document.getElementById("topLeftBtn");


// -------------------- Init popup --------------------
document.addEventListener("DOMContentLoaded", async () => {
  const hostname = await getActiveHostname();

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
    if (area !== "local") return;

    if (changes.sessionCompleteIndicator) {
      celebrateSession();
    }

    // Handle absoluteFocusmode changes
    if (changes.absoluteFocusmode) {
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
    }

    // Handle focusMode changes - display image when trying to deactivate during cooloff
    if (changes.focusMode && changes.focusMode.newValue === true) {
      chrome.storage.local.get("absoluteFocusmode", ({ absoluteFocusmode }) => {
        if (absoluteFocusmode === true) {
          displayImage(true);
        }
      });
    }
  });

  btn.addEventListener("click", () => {
    focus(); // request change only
  });



  chrome.storage.local.get("block", (data) => {
    const blocked = data.block ?? [];

    // Toggle button state
    const isBlocked = blocked.includes(hostname);
    addBtn.classList.toggle("tag", isBlocked);
    addBtn.textContent = isBlocked ? "Remove" : "Add";

    // Render icons
    renderBlockedIcons(blocked, iconContainer);
  });

  addBtn.addEventListener("click", async () => {
    // Check if focus mode is active
    const { absoluteFocusmode } = await chrome.storage.local.get("absoluteFocusmode");
    if (absoluteFocusmode) {
      clear_tooltipTimers();
      tooltip.classList.add("show");
      tooltipTimer_show = setTimeout(() => tooltip.classList.remove("show"), 2000);
      return;
    }

    const hostname = await getActiveHostname();
    if (!hostname) return;

    // console.log("Website entered:", hostname);

    chrome.storage.local.get("block", (data) => {
      const blocked = data.block ?? [];

      if (!blocked.includes(hostname)) {
        blocked.push(hostname);
        chrome.storage.local.set({ block: blocked }, () => {
          // Tooltip
          clear_tooltipTimers();

          tooltip.classList.add("add");
          tooltip.textContent = `"${hostname}" is added!`
          tooltipTimer_add = setTimeout(() => tooltip.classList.remove("add"), 2000);
          // console.log("Updated block list:", blocked);
        });
        addBtn.classList.toggle("tag", true);
        addBtn.textContent = "Remove";
      } else {
        const index = blocked.indexOf(hostname);
        blocked.splice(index, 1);
        chrome.storage.local.set({ block: blocked }, () => {
          // console.log("Removed from block list:", blocked);
          // Tooltip
          clear_tooltipTimers();

          tooltip.classList.add("remove");
          tooltip.textContent = `"${hostname}" is removed!`
          tooltipTimer_remove = setTimeout(() => tooltip.classList.remove("remove"), 2000);
        });
        addBtn.classList.toggle("tag", false);
        addBtn.textContent = "Add";
      }

      // Re-render icons
      renderBlockedIcons(blocked, iconContainer);
    });

  });

  userBtn.addEventListener("click", async () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("login.html") });
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

  // Current session time
  let sessionSecs = 0;
  if (absoluteFocusmode && start) {
    sessionSecs = Math.floor((Date.now() - start) / 1000);
  }

  await renderTime(sessionSecs);
  renderTotalTime(total_time + sessionSecs);
}

// ++++++++++++++++++++++++++++++++++++++++++++++
// This part has the circular progress bar as well
// ++++++++++++++++++++++++++++++++++++++++++++++
async function renderTime(secs) {
  const hours = Math.floor(secs / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  const seconds = secs % 60;

  document.getElementById("timer").textContent =
    `${String(hours).padStart(2, "0")}:` +
    `${String(minutes).padStart(2, "0")}`;

  // Update circular progress bar (max 8 hours)
  const { sessionTime } = await chrome.storage.local.get("sessionTime");
  const maxTime = sessionTime * 60; // 25 minutes in seconds
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

function renderTotalTime(secs) {
  const hours = Math.floor(secs / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  const seconds = secs % 60;

  const el = document.getElementById("totalTime");
  if (el) {
    el.textContent = `Total: ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }
}



// // +++++++++++++++++++++++++++++++++++++++++++++
// // Render icons of the websites in blocked list
// // +++++++++++++++++++++++++++++++++++++++++++++
function renderBlockedIcons(blocked, container) {
  container.innerHTML = "";

  blocked.forEach(site => {
    const button = document.createElement("button");
    button.type = "button";
    button.title = site;
    button.className = "blocked-site-btn";

    const img = document.createElement("img");
    img.src = `https://www.google.com/s2/favicons?sz=64&domain=${site}`;
    img.alt = site;
    img.title = site;
    img.width = 32;
    img.height = 32;

    // Create cross icon outside of click handler
    const cross = document.createElement("img");
    cross.src = "close.png";
    cross.className = "remove-icon";

    button.appendChild(img);
    button.appendChild(cross);

    // Click handler
    button.addEventListener("click", async () => {
      // console.log("Clicked:", site);
      // Block the remove functionality if still in focusmode
      const { absoluteFocusmode } = await chrome.storage.local.get("absoluteFocusmode");
      if (absoluteFocusmode) {
        clear_tooltipTimers();
        tooltip.classList.add("show");
        tooltipTimer_show = setTimeout(() => tooltip.classList.remove("show"), 2000);
        return;
      }

      const { block = [] } = await chrome.storage.local.get("block");

      const index = block.indexOf(site);

      if (index !== -1) {
        block.splice(index, 1); // Remove from array
        await chrome.storage.local.set({ block: block });
      }


      button.remove(); // Remove from DOM

      // Tooltip
      clear_tooltipTimers();
      tooltip.classList.add("remove");
      tooltip.textContent = `"${site}" is removed!`
      tooltipTimer_remove = setTimeout(() => tooltip.classList.remove("remove"), 2000);

      const activeHost = await getActiveHostname();

      if (activeHost === site) {
        addBtn.classList.toggle("tag", false);
        addBtn.textContent = "Add";
      }
    })

    container.appendChild(button);

  });
}

// ======================================================
// Confetti
// ======================================================

async function celebrateSession() {
  if (typeof confetti === 'undefined') {
    console.warn('confetti library not loaded');
    return;
  }

  const duration = 2000;
  const animationEnd = Date.now() + duration;
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 10000 };

  function randomInRange(min, max) {
    return Math.random() * (max - min) + min;
  }

  const interval = setInterval(function () {
    const timeLeft = animationEnd - Date.now();

    if (timeLeft <= 0) {
      return clearInterval(interval);
    }

    const particleCount = 50 * (timeLeft / duration);

    // Burst from left side
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
    });

    // Burst from right side
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
    });
  }, 250);
}



// ================================================
// Second view logic
// ================================================
const topRightBtn = document.getElementById("topRightBtn");
const mainView = document.getElementById("view-main");
const urlView = document.getElementById("view-url");

let showingMainView = true;

topRightBtn.addEventListener("click", () => {
  if (showingMainView) {
    mainView.classList.remove("view-active");
    urlView.classList.add("view-active");
    topRightBtn.textContent = "Back"; // optional
  } else {
    urlView.classList.remove("view-active");
    mainView.classList.add("view-active");
    topRightBtn.textContent = "Blocked"; // optional
  }

  showingMainView = !showingMainView;
});

// ====================================================
// Tool tip
// ====================================================
let tooltipTimer_show = null;
let tooltipTimer_add = null;
let tooltipTimer_remove = null;

function clear_tooltipTimers() {
  clearTimeout(tooltipTimer_add);
  clearTimeout(tooltipTimer_remove);
  clearTimeout(tooltipTimer_show);
  // Also remove all tooltip classes to prevent color conflicts
  tooltip.classList.remove("show", "add", "remove");
}