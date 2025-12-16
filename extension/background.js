// -------------------- Constants --------------------
const REDIRECT_RULE_ID = 1;
const reset_time = 600000; // 10 minutes for now
const WS_URL = "ws://10.91.190.102:81";

// -------------------- State --------------------
let ws = null;

// -------------------- Init storage safely --------------------
chrome.storage.local.get(
  ["focusMode", "total_time", "absoluteFocusmode", "start"],
  (data) => {
    if (data.focusMode === undefined)
      chrome.storage.local.set({ focusMode: false });

    if (data.total_time === undefined)
      chrome.storage.local.set({ total_time: 0 });

    if (data.absoluteFocusmode === undefined)
      chrome.storage.local.set({ absoluteFocusmode: false });

    if (data.start === undefined)
      chrome.storage.local.set({ start: 0 });
  }
);

// -------------------- Time tracking --------------------
async function elapsedSeconds() {
  const end = Date.now();
  const { start = 0, total_time = 0 } =
    await chrome.storage.local.get(["start", "total_time"]);

  if (start === 0) return;

  const elapsed = Math.floor((end - start) / 1000);
  await chrome.storage.local.set({
    total_time: total_time + elapsed,
    start: 0
  });
}

// --------------------Reset total time after t time---------
async function resetTotal_time(){
  chrome.storage.local.set({total_time:0});
}


// -------------------- Redirect logic --------------------
async function enableRedirectRules() {
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [REDIRECT_RULE_ID],
    addRules: [
      {
        id: REDIRECT_RULE_ID,
        priority: 1,
        action: {
          type: "redirect",
          redirect: { extensionPath: "/focus.html" }
        },
        condition: {
          urlFilter: "*",
          resourceTypes: ["main_frame"]
        }
      }
    ]
  });
  console.log("Redirect rules enabled");
}

async function disableRedirectRules() {
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [REDIRECT_RULE_ID]
  });
  console.log("Redirect rules disabled");
}

// -------------------- WebSocket --------------------
function connectWebSocket() {
  ws = new WebSocket(WS_URL);

  ws.onopen = () => console.log("WebSocket connected");

  ws.onmessage = (event) => {
    if (event.data === "ACTIVATE_FOCUS") {
      chrome.storage.local.set({
        focusMode: true,
        source: "ws"
      });
    }

    if (event.data === "DEACTIVATE_FOCUS") {
      chrome.storage.local.set({
        focusMode: false,
        source: "ws"
      });
    }
  };

  ws.onerror = (err) => console.error("WebSocket error", err);

  ws.onclose = () => {
    console.log("WebSocket closed, reconnecting...");
    setTimeout(connectWebSocket, 5000);
  };
}

// -------------------- Reactive observer --------------------
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "local" || !changes.focusMode) return;

  const newFocus = changes.focusMode.newValue;
  const source = changes.source?.newValue;

  if (newFocus) {
    const start = Date.now();
    await chrome.storage.local.set({ start });

    await enableRedirectRules();
    await chrome.storage.local.set({ absoluteFocusmode: true });

    console.log("Focus mode ON");

    if (ws?.readyState === WebSocket.OPEN && source !== "ws") {
      ws.send("activate");
    }
  } else {
    const { start = 0 } = await chrome.storage.local.get("start");
    const elapsed = Date.now() - start;

    console.log("tried")
    if (elapsed < 60000) {
      console.log("Deactivation blocked (1 min lock)");

      // Re-assert truth
      await chrome.storage.local.set({
        focusMode: true,
        absoluteFocusmode: true
      });

      return;
    }

    // ---- Deactivation allowed ----
    await disableRedirectRules();
    await chrome.storage.local.set({ absoluteFocusmode: false });

    await elapsedSeconds();

    console.log("Focus mode OFF");

    if (ws?.readyState === WebSocket.OPEN && source !== "ws") {
      ws.send("deactivate");
    }
  }
});

// -------------------- Start --------------------
connectWebSocket();

setInterval(resetTotal_time, reset_time)