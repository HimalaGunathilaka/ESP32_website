/**
 * @fileoverview Reactive observer for storage changes.
 * Acts as the central coordinator for UI, MQTT, and Blocking logic.
 */

import { safeMQTTInit, client } from "./mqtt.js";
import { enableRedirectRules, redirectCurrentTabs, clearAllRedirectRules } from '../main/redirect.js';
import { handleTabChange_icon } from "./icon.js";

const COOLOFF_TIME = 5000;

chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area !== 'local') return;

    // 1. Batch fetch current state to minimize async overhead
    const state = await chrome.storage.local.get([
        'username', 'absoluteFocusMode', 'focusMode', 'focusSource',
        'sessionCount', 'sessionTime', 'sessionComplete', 'urlMutex', 'block', 'start'
    ]);

    const { username, absoluteFocusMode, urlMutex, block = [] } = state;

    // ----------------------------------------------------------
    // AUTHENTICATION & CONNECTION
    // ----------------------------------------------------------
    if (changes.isLogged) {
        if (changes.isLogged.newValue) {
            await chrome.storage.local.set({ date: new Date().toISOString() });
            safeMQTTInit();
            chrome.alarms.create('mqttPing', { periodInMinutes: 0.5 });
        } else if (typeof client !== 'undefined' && client) {
            client.end(false);
        }
    }

    // ----------------------------------------------------------
    // BLOCK LIST SYNC (MQTT <-> LOCAL)
    // ----------------------------------------------------------
    if (changes.block) {
        handleTabChange_icon();

        if (urlMutex === 'mqtt') {
            // Logic came from server/MQTT: Reset mutex and stop to avoid echo
            await chrome.storage.local.set({ urlMutex: 'none' });
        } else if (typeof client !== 'undefined' && client?.connected) {
            // Logic came from UI: Publish diff to MQTT
            await syncBlockListToMqtt(changes.block.oldValue || [], changes.block.newValue || [], username);
        }

        if (absoluteFocusMode) await redirectCurrentTabs(block);
    }

    // ----------------------------------------------------------
    // FOCUS MODE LOGIC (ACTIVATE / DEACTIVATE)
    // ----------------------------------------------------------
    if (changes.focusMode) {

        await handleFocusModeToggle(changes.focusMode.newValue, state);
    }

    // ----------------------------------------------------------
    // SESSION ALARMS
    if (changes.absoluteFocusMode) {
        const isEnabled = changes.absoluteFocusMode.newValue;
        if (isEnabled) {
            chrome.alarms.create('focusSessionEnd', { delayInMinutes: state.sessionTime });
        } else if (!state.sessionComplete) {
            chrome.alarms.clear('focusSessionEnd');
        }
    }
});

/**
 * Handles the logic when focus mode is turned on or off.
 */
async function handleFocusModeToggle(isStarting, state) {
    const { username, sessionCount, start, absoluteFocusMode, block } = state;
    const now = Date.now();

    if (isStarting && !absoluteFocusMode) {
        // START FOCUS
        const startTime = start === 0 ? now : start;
        await chrome.storage.local.set({
            start: startTime,
            date: new Date().toISOString(),
            absoluteFocusMode: true
        });

        await enableRedirectRules(block);
        await redirectCurrentTabs(block);

        publishMqtt(username, 'activate', `a|${sessionCount}`);

    } else if (!isStarting && absoluteFocusMode) {
        // STOP FOCUS (with Cool-off check)
        if (now - start < COOLOFF_TIME) {
            // Revert if too soon
            await chrome.storage.local.set({ focusMode: true, absoluteFocusMode: true });
            return;
        }

        await clearAllRedirectRules();
        await chrome.storage.local.set({ absoluteFocusMode: false, focusMode: false, start: 0 });

        const status = state.sessionComplete ? 'c' : 'n';
        publishMqtt(username, 'activate', `d|${status}|${sessionCount}`);
    }
}

/**
 * Helper to determine exactly which URLs were added or removed.
 */
function syncBlockListToMqtt(oldArr, newArr, username) {
    const added = newArr.filter(x => !oldArr.includes(x));
    const removed = oldArr.filter(x => !newArr.includes(x));

    added.forEach(url => publishMqtt(username, 'block/extension', `a|${url}`));
    removed.forEach(url => publishMqtt(username, 'block/extension', `d|${url}`));
}

/**
 * Safely publishes to MQTT if client is available.
 */
function publishMqtt(username, topicSuffix, message) {
    if (typeof client !== 'undefined' && client?.connected) {
        client.publish(`${username}/focus/${topicSuffix}`, message, { retain: true });
    }
}