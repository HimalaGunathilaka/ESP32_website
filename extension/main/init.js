/**
 * @fileoverview Initializes the extension storage with default values 
 * if they are not already set.
 */

(async () => {
  // 1. Define all default values in one clear object
  const DEFAULTS = {
    focusMode: false,
    absoluteFocusmode: false, 
    total_time: 0, 
    start: 0,
    date: new Date().toISOString(),
    block: [],
    urlMutex: 'none',
    source: false,
    focusSource: 'local',
    sessionCount: 0,
    sessionComplete: false,
    sessionCompleteIndicator: false,
    sessionTime: 2,
    naturalCompletion: false,
    isLogged: false,
    username: 'Guest',
    token: '',
    deviceId: '',
    deviceConnected: false
  };

  try {
    // 2. Fetch current storage
    const currentData = await chrome.storage.local.get(Object.keys(DEFAULTS));

    // 3. Identify which keys are missing
    const updates = {};
    for (const key in DEFAULTS) {
      if (currentData[key] === undefined) {
        updates[key] = DEFAULTS[key];
      }
    }

    // 4. Batch update only the missing keys in a single call
    if (Object.keys(updates).length > 0) {
      await chrome.storage.local.set(updates);
      console.log('Storage initialized with defaults:', Object.keys(updates));
    }
  } catch (error) {
    console.error('Error initializing storage:', error);
  }
})();