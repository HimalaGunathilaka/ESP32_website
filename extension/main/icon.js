/**
 * @fileoverview Manages the extension icon state based on the current tab's 
 * URL and the user's blocked list.
 */

// ---------------------------------------------------------
// Event Listeners
// ---------------------------------------------------------

// Trigger when the user switches tabs
chrome.tabs.onActivated.addListener(handleTabChange_icon);

// Trigger as soon as the URL starts loading (loading) rather than when finished (complete)
// This makes the UI feel much more responsive.
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url || changeInfo.status === 'loading') {
        handleTabChange_icon();
    }
});

/**
 * Updates the extension icon based on the active tab's domain.
 */

async function handleTabChange_icon() {
    try {
        const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true
        });

        // Define standard icon sets
        const ICONS_DEFAULT = {
            16: 'icons/icon16.png',
            32: 'icons/icon32.png',
            48: 'icons/icon48.png',
            128: 'icons/icon128.png'
        };

        const ICONS_BLOCKED = {
            16: 'icons/icon_glow16.png',
            32: 'icons/icon_glow32.png',
            48: 'icons/icon_glow48.png',
            128: 'icons/icon_glow128.png'
        };

        if (!tab?.url || !tab.url.startsWith('http')) {
            chrome.action.setIcon({ path: ICONS_DEFAULT });
            return;
        }

        const { block = [] } = await chrome.storage.local.get("block");
        const hostname = new URL(tab.url).hostname;

        const isTabBlocked = checkBlockedStatus(hostname, block);
        chrome.action.setIcon({
            path: isTabBlocked ? ICONS_BLOCKED : ICONS_DEFAULT
        });

    } catch (err) {
        // Fail silently to avoid console clutter during tab transitions
        console.debug('Icon update skipped:', err);
    }
}

/**
 * Logic to determine if a hostname matches the blocked list.
 * 
 * @param {string} hostname 
 * @param {string[]} blockList 
 * @returns {boolean}
 */
function checkBlockedStatus(hostname, blockList) {
    const cleanHost = hostname.replace(/^www\./, '');
    return blockList.some(site => {
        const blockedHost = normalizeHost(site);
        if (!blockedHost) return false;

        return (
            cleanHost === blockedHost ||
            cleanHost.endsWith('.' + blockedHost)
        );
    });
}


/**
 * Normalizes strings or URLs into a clean hostname.
 */
function normalizeHost(input) {
    try {
        const urlString = input.includes('://') ? input : `https://${input}`;
        const url = new URL(urlString);
        return url.hostname.replace(/^www\./, '');
    } catch {
        return null;
    }
}