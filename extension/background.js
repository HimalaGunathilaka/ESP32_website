// -------------------- Constants --------------------
const REDIRECT_RULE_ID = 1;
const RESET_TIME = 600000; // 10 minutes
const WS_URL = "ws://10.91.190.102:81";
const COOLOFF_TIME = 5000;

// -------------------- State --------------------
let ws = null;

// -------------------- Init storage safely --------------------
chrome.storage.local.get(
  ["focusMode", "total_time", "absoluteFocusmode", "start", "block"],
  (data) => {
    if (data.focusMode === undefined)
      chrome.storage.local.set({ focusMode: false });

    if (data.total_time === undefined)
      chrome.storage.local.set({ total_time: 0 });

    if (data.absoluteFocusmode === undefined)
      chrome.storage.local.set({ absoluteFocusmode: false });

    if (data.start === undefined)
      chrome.storage.local.set({ start: 0 });

    if (data.block === undefined)
      chrome.storage.local.set({
        block: [
          "youtube",
          "facebook",
          "twitter"
        ]
      })
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

// --------------Reset total time after t time---------------
// --------------To depict the end of the day----------------
async function resetTotal_time() {
  // const { total_time = 0 } = await chrome.storage.local.get(["total_time"]);
  // console.log("total_time:", total_time);
  chrome.storage.local.set({ total_time: 0 });
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
  // console.log("Redirect rules enabled");
}

async function redirectCurrentTab() {
  const tabs = await chrome.tabs.query({});
  const { block = [] } = await chrome.storage.local.get("block");

  for (const tab of tabs) {
    if (!tab?.id || !tab?.url) continue;
    if (tab.url.includes("focus.html")) continue;
    if (tab.url.startsWith("chrome://") || tab.url.startsWith("brave://")) continue;

    // Iterate over all the urls inside of block
    if (block.some(site => tab.url.includes(site))) {
      chrome.tabs.update(tab.id, {
        url: chrome.runtime.getURL("focus.html")
      });
    }
  }
}

async function disableRedirectRules() {
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [REDIRECT_RULE_ID]
  });
  // console.log("Redirect rules disabled");
}

// -------------------- WebSocket --------------------
function connectWebSocket() {
  ws = new WebSocket(WS_URL);

  ws.onopen = () => //console.log("WebSocket connected");

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

  ws.onerror = (err) => //console.error("WebSocket error", err);

    ws.onclose = () => {
      // console.log("WebSocket closed, reconnecting...");
      setTimeout(connectWebSocket, 5000);
    };
}

// -------------------- Reactive observer --------------------
chrome.storage.onChanged.addListener(async (changes, area) => {
  // console.log("Start of observer");
  if (area !== "local" || !changes.focusMode) return;

  const newFocus = changes.focusMode.newValue;
  const source = changes.source?.newValue;
  const { start } = await chrome.storage.local.get("start");

  if (newFocus) {

    if (start === 0) {
      await chrome.storage.local.set({ start: Date.now() });
      // console.log("Start time set");
    } else {
      // console.log("Start already set")
    }

    await enableRedirectRules();
    await redirectCurrentTab();
    await chrome.storage.local.set({ absoluteFocusmode: true });

    // console.log("Focus mode ON");

    if (ws?.readyState === WebSocket.OPEN && source !== "ws") {
      ws.send("activate");
    }
  } else {
    const elapsed = Date.now() - start;

    // console.log("tried")
    if (elapsed < COOLOFF_TIME) {
      // console.log("Deactivation blocked (1 min lock)");
      // console.log(elapsed);

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

    // console.log("Focus mode OFF");

    if (ws?.readyState === WebSocket.OPEN && source !== "ws") {
      ws.send("deactivate");
    }
  }
});

// -------------------- Start --------------------
connectWebSocket();

setInterval(resetTotal_time, RESET_TIME);

setInterval(() => {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send("ping");
  }
}, 15000);
