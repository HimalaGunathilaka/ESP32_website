const REDIRECT_RULE_ID = 1;

// -------------------- Redirect logic --------------------
const REDIRECT_RULE_BASE_ID = 1000; // base id to avoid collisions


async function enableRedirectRules() {
    const { block = [] } = await chrome.storage.local.get("block");

    // Remove previous redirect rules (use index-based IDs)
    const removeRuleIds = block.map((_, i) => REDIRECT_RULE_BASE_ID + i);

    // Create redirect rules for each blocked site (use index-based IDs for uniqueness)
    const addRules = block
        .filter(site => site) // Filter out empty/null entries
        .map((site, i) => ({
            id: REDIRECT_RULE_BASE_ID + i,
            priority: 1,
            action: {
                type: "redirect",
                redirect: {
                    extensionPath: "/focus.html"
                }
            },
            condition: {
                urlFilter: site,               // ← uses block entries
                resourceTypes: ["main_frame"]
            }
        }));

    await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds,
        addRules
    });

    // console.log("Redirect rules enabled for:", block);
}


// ----Check all tabs and block them-----
async function redirectCurrentTab() {
    const tabs = await chrome.tabs.query({});
    const { block = [] } = await chrome.storage.local.get("block");

    for (const tab of tabs) {
        if (!tab?.id || !tab?.url) continue;
        if (tab.url.includes("focus.html")) continue;
        // if (tab.url.startsWith("chrome://") || tab.url.startsWith("brave://")) continue;

        // Iterate over all the urls inside of block
        if (block.some(site => tab.url.includes(site))) {
            chrome.tabs.update(tab.id, {
                url: chrome.runtime.getURL("focus.html")
            });
        }
    }
}


async function clearAllRedirectRules() {
    const rules = await chrome.declarativeNetRequest.getDynamicRules();
    const ids = rules.map(r => r.id);
    if (ids.length) {
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: ids
        });
    }
}
