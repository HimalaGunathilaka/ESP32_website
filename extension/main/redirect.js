/**
 * @fileoverview Manages declarativeNetRequest rules and tab redirection
 * for blocked websites.
 */

const REDIRECT_RULE_BASE_ID = 1000; // base id to avoid collisions

/**
 * Updates dynamic rules to block sites in the block list.
 * @param {string[]} block List of URL patterns to block.
 */

async function enableRedirectRules(block = []) {
    await clearAllRedirectRules();

    if (block.length === 0) return;

    const addRules = block
        .filter(site => site && site.trim() !== '') // Filter out empty/null entries
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
                // Standardize filter to ensure it matches domains correctly
                urlFilter: `*://${site}/*`,
                resourceTypes: ["main_frame"]
            }
        }));

    try {
        await chrome.declarativeNetRequest.updateDynamicRules({
            addRules: addRules
        });
    } catch (err) {
        console.error('Failed to update DNR rules:', err);
    }
}

/**
 * Scans all open tabs and redirects those that match the block list.
 * @param {string[]} block List of URL patterns to block.
 */
async function redirectCurrentTab(block = []) {
    if (block.length === 0) return;

    const tabs = await chrome.tabs.query({ windowType: 'normal' });
    const focusUrl = chrome.runtime.getURL('focus.html');

    for (const tab of tabs) {
        if (!tab.id || !tab.url || tab.url.includes(focusUrl)) continue;

        const isBlocked = block.some(site => tab.url.includes(site));

        if (isBlocked) {
            // Use await to avoid flooding the browser with update requests
            await chrome.tabs.update(tab.id, { url: focusUrl });
        }
    }
}

/**
 * Remove all the dynamic rules created by this extension.
 */
async function clearAllRedirectRules() {
    const rules = await chrome.declarativeNetRequest.getDynamicRules();
    const ids = rules.map(r => r.id);
    if (ids.length) {
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: ids
        });
    }
}
