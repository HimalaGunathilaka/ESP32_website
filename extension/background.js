// -------------------- Constants --------------------
const REDIRECT_RULE_ID = 1;
const WS_URL = "ws://10.91.190.102:81";

// -------------------- State --------------------
let ws = null;
let start = 0;

// -------------------- Init storage safely --------------------
chrome.storage.local.get(["focusMode", "total_time"], (data) => {
  if (data.focusMode === undefined) {
    chrome.storage.local.set({ focusMode: false });
  }
  if (data.total_time === undefined) {
    chrome.storage.local.set({ total_time: 0 });
  }
});

// -------------------- Time tracking --------------------
async function elapsedSeconds() {
  const end = Date.now();
  const elapsed = Math.floor((end - start) / 1000);

  const { total_time = 0 } = await chrome.storage.local.get("total_time");
  await chrome.storage.local.set({ total_time: total_time + elapsed });
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

  ws.onopen = () => {
    console.log("WebSocket connected");
  };

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

  ws.onerror = (err) => {
    console.error("WebSocket error", err);
  };

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
    start = Date.now();
    console.log("Focus mode ON");

    await enableRedirectRules();

    if (ws?.readyState === WebSocket.OPEN && source !== "ws") {
      ws.send("activate");
    }
  } else {
    console.log("Focus mode OFF");

    await disableRedirectRules();

    if (start !== 0) await elapsedSeconds();

    if (ws?.readyState === WebSocket.OPEN && source !== "ws") {
      ws.send("deactivate");
    }
  }
});

// -------------------- Start --------------------
connectWebSocket();
