
// ======================================================
// Listeners to change the icon
// ======================================================
chrome.tabs.onActivated.addListener(handleTabChange_icon);
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete") {
        handleTabChange_icon();
    }
})

async function handleTabChange_icon() {
    const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
    });

    if (!tab?.url || !tab.url.startsWith("http")) {
        chrome.action.setIcon({ path: "icons/icon32.png" });
        return;
    }

    const hostname = new URL(tab.url).hostname;
    const { block = [] } = await chrome.storage.local.get("block");

    const exists = isBlocked(hostname, block);

    chrome.action.setIcon({
        path: exists
            ? {
                16: "icons/icon_glow16.png",
                32: "icons/icon_glow32.png",
                48: "icons/icon_glow48.png",
                128: "icons/icon_glow128.png"
            }
            : {
                16: "icons/icon16.png",
                32: "icons/icon32.png",
                48: "icons/icon48.png",
                128: "icons/icon128.png"
            }
    });
}

function isBlocked(hostname, blockList) {
    const cleanHost = hostname.replace(/^www\./, "");

    return blockList.some(site => {
        const blockedHost = normalizeHost(site);
        if (!blockedHost) return false;

        return (
            cleanHost === blockedHost ||
            cleanHost.endsWith("." + blockedHost)
        );
    });
}

function normalizeHost(input) {
    try {
        const url = input.startsWith("http")
            ? new URL(input)
            : new URL("https://" + input);
        return url.hostname.replace(/^www\./, "");
    } catch {
        return null;
    }
}