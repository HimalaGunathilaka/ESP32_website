let focusMode = false;
let ws = null;

let start = 0;
let total_time =0;

async function elapsedSeconds() {
  const end = Date.now();
  console.log("end:",end)
  console.log("start:",start)
  console.log("end-start", end- start)
  console.log(total_time)
  total_time = total_time + Math.floor((end - start)/1000)

  chrome.storage.local.set({total_time:total_time});
}
// Rule ID for the redirect rule
const REDIRECT_RULE_ID = 1;

// Function to connect/reconnect WebSocket
function connectWebSocket() {
  ws = new WebSocket("ws://10.91.190.102:81");

  ws.onopen = () => {
    console.log("WebSocket connected to ESP32");
  };

  ws.onmessage = async (event) => {
    if (event.data === "ACTIVATE_FOCUS") {
      focusMode = true;
      start = Date.now();
      console.log("Focus mode ON");

      await enableRedirectRules();
    }
    if (event.data === "DEACTIVATE_FOCUS") {
      focusMode = false;
      console.log("Focus mode OFF");
      await disableRedirectRules();

      if (start !== 0) {
        elapsedSeconds();
      }
    }
  };

  ws.onerror = (error) => {
    console.error("WebSocket error:", error);
  };

  ws.onclose = () => {
    console.log("WebSocket disconnected. Reconnecting in 5 seconds...");
    setTimeout(connectWebSocket, 5000);
  };
}

// Enable redirect rules
async function enableRedirectRules() {
  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [REDIRECT_RULE_ID],
      addRules: [
        {
          id: REDIRECT_RULE_ID,
          priority: 1,
          action: {
            type: "redirect",
            redirect: {
              extensionPath: "/focus.html"
            }
          },
          condition: {
            urlFilter: "*",
            resourceTypes: ["main_frame"]
          }
        }
      ]
    });
    console.log("Redirect rules enabled");
  } catch (error) {
    console.error("Error enabling rules:", error);
  }
}

// Disable redirect rules
async function disableRedirectRules() {
  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [REDIRECT_RULE_ID]
    });
    console.log("Redirect rules disabled");
  } catch (error) {
    console.error("Error disabling rules:", error);
  }
}

chrome.storage.local.set({total_time:0});

// Initialize WebSocket connection
connectWebSocket();
