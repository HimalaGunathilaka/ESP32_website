/**
 * @fileoverview Main logic for the extension's popup UI.
 * Handles timers, block list rendering, hardware sync, and view switching.
 */


// ============================================================================
// Constants & UI Element Cache
// ============================================================================

const SERVER_BASE = 'http://localhost:8080';
const CIRCUMFERENCE = 534.07;

// Cache DOM elements to avoid querying the DOM repeatedly
const UI = {
  mainView: document.getElementById('view-main'),
  urlView: document.getElementById('view-url'),
  btnToggleView: document.getElementById('topRightBtn'),
  btnUser: document.getElementById('topLeftBtn'),
  btnFocus: document.getElementById('focusBtn'),
  btnAdd: document.getElementById('addBtn'),
  btnEsp: document.getElementById('espBtn'),
  iconContainer: document.getElementById('iconList'),
  tooltip: document.getElementById('addTooltip'),
  timerLabel: document.getElementById('timer'),
  totalTimeLabel: document.getElementById('totalTime'),
  progressCircle: document.getElementById('progressCircle'),
  pict: document.getElementById('pict')
};

// Global State
let isShowingMainView = true;
let tooltipTimeout = null;
let timerInterval = null;

// ============================================================================
// Initialization
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();

  // Fetch initial system truth in one batch
  const state = await chrome.storage.local.get([
    'absoluteFocusMode', 'isLogged', 'username', 'naturalCompletion', 'block', 'sessionTime'
  ]);

  // Initialize UI based on state
  updateAuthUI(state.isLogged, state.username);
  updateFocusUI(state.absoluteFocusMode);

  const hostname = await getActiveHostname();
  updateAddButtonUI(hostname, state.block || []);
  renderBlockedIcons(state.block || []);

  if (state.naturalCompletion) {
    celebrateSession();
    await chrome.storage.local.set({ naturalCompletion: false });
  }

  // Start the UI timer loop
  updateTimerUI();
  timerInterval = setInterval(updateTimerUI, 1000);
});

// ============================================================================
// Event Listeners
// ============================================================================

function setupEventListeners() {
  // View toggles
  UI.btnToggleView.addEventListener('click', toggleView);

  // Primary actions
  UI.btnFocus.addEventListener('click', handleFocusToggle);
  UI.btnAdd.addEventListener('click', handleAddRemoveSite);
  UI.btnUser.addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('login.html') }));
  UI.btnEsp.addEventListener('click', handleEspConnection);

  // Storage listener (Registered ONCE at the top level)
  chrome.storage.onChanged.addListener(handleStorageChanges);
}

// ============================================================================
// Core Logic Handlers
// ============================================================================

async function handleFocusToggle() {
  const { focusMode } = await chrome.storage.local.get('focusMode');
  await chrome.storage.local.set({
    focusMode: !focusMode,
    focusSource: 'local'
  });
}

async function handleAddRemoveSite() {
  const { absoluteFocusMode, block = [] } = await chrome.storage.local.get(['absoluteFocusMode', 'block']);

  if (absoluteFocusMode) {
    showTooltip("Can't edit while focusing", 'show');
    return;
  }

  const hostname = await getActiveHostname();
  if (!hostname) return;

  const isBlocked = block.includes(hostname);
  let updatedBlockList;

  if (isBlocked) {
    updatedBlockList = block.filter(site => site !== hostname);
    sendToServer('POST', '/url/remove', { url: hostname });
    showTooltip(`"${hostname}" removed!`, 'remove');
  } else {
    updatedBlockList = [...block, hostname];
    sendToServer('POST', '/url/add', { url: hostname });
    showTooltip(`"${hostname}" added!`, 'add');
  }

  await chrome.storage.local.set({ block: updatedBlockList });
  updateAddButtonUI(hostname, updatedBlockList);
  renderBlockedIcons(updatedBlockList);
}

function handleStorageChanges(changes, area) {
  if (area !== 'local') return;

  if (changes.isLogged || changes.username) {
    chrome.storage.local.get(['isLogged', 'username'], (data) => {
      updateAuthUI(data.isLogged, data.username);
    });
  }

  if (changes.absoluteFocusMode) {
    updateFocusUI(changes.absoluteFocusMode.newValue);
    if (changes.absoluteFocusMode.newValue) {
      chrome.storage.local.set({ start: Date.now() });
    } else {
      UI.pict.style.display = 'none';
      chrome.storage.local.set({ start: 0 });
    }
  }

  if (changes.focusMode?.newValue === true) {
    chrome.storage.local.get('absoluteFocusMode', ({ absoluteFocusMode }) => {
      if (absoluteFocusMode) UI.pict.style.display = 'block';
    });
  }

  if (changes.sessionTime) {
    updateTimerUI();
  }

  if (changes.naturalCompletion?.newValue === true) {
    celebrateSession();
    chrome.storage.local.set({ naturalCompletion: false });
  }
}

async function handleEspConnection() {
  UI.btnEsp.textContent = 'Connecting...';
  const deviceId = await fetchDeviceId();

  if (deviceId) {
    await chrome.storage.local.set({ deviceId });
    await sendToServer('POST', '/device/put', { deviceId });
    UI.btnEsp.textContent = 'Connected';
    UI.btnEsp.classList.add('active');
  } else {
    UI.btnEsp.textContent = 'Failed';
    setTimeout(() => UI.btnEsp.textContent = 'Disconnected', 2000);
  }
}

// ============================================================================
// UI Updaters
// ============================================================================

function toggleView() {
  isShowingMainView = !isShowingMainView;
  UI.mainView.classList.toggle('view-active', isShowingMainView);
  UI.urlView.classList.toggle('view-active', !isShowingMainView);
  UI.btnToggleView.textContent = isShowingMainView ? 'Blocked List' : 'Settings';
}

function updateAuthUI(isLogged, username) {
  if (isLogged && username) {
    UI.btnUser.textContent = username;
    UI.btnUser.classList.add('active');
    UI.btnEsp.style.visibility = 'visible';
  } else {
    UI.btnUser.textContent = 'Guest';
    UI.btnUser.classList.remove('active');
    UI.btnEsp.style.visibility = 'hidden';
  }
}

function updateFocusUI(isActive) {
  UI.btnFocus.classList.toggle('active', isActive);
  UI.btnFocus.textContent = isActive ? 'Focusing...' : 'Focus';
  if (UI.progressCircle) {
    UI.progressCircle.classList.toggle('active', isActive);
    if (!isActive) UI.progressCircle.style.strokeDashoffset = CIRCUMFERENCE;
  }
}

function updateAddButtonUI(hostname, blockList) {
  const isBlocked = blockList.includes(hostname);
  UI.btnAdd.classList.toggle('tag', isBlocked);
  UI.btnAdd.textContent = isBlocked ? 'Remove' : 'Add';
}

function showTooltip(text, cssClass) {
  clearTimeout(tooltipTimeout);
  UI.tooltip.className = 'tooltip'; // Reset classes

  UI.tooltip.textContent = text;
  UI.tooltip.classList.add(cssClass);

  tooltipTimeout = setTimeout(() => {
    UI.tooltip.classList.remove(cssClass);
  }, 2000);
}

async function updateTimerUI() {
  const { absoluteFocusMode, sessionCount = 0, sessionTime = 2, start } =
    await chrome.storage.local.get(['absoluteFocusMode', 'sessionCount', 'sessionTime', 'start']);

  let totalSecs = sessionCount * sessionTime * 60;
  let currentSessionSecs = 0;

  if (absoluteFocusMode && start) {
    currentSessionSecs = Math.floor((Date.now() - start) / 1000);
    totalSecs += currentSessionSecs;

    // Update circular progress
    const maxTime = sessionTime * 60;
    const progress = Math.min(currentSessionSecs / maxTime, 1);
    if (UI.progressCircle) {
      UI.progressCircle.style.strokeDashoffset = CIRCUMFERENCE * (1 - progress);
    }
  }

  // Update text labels
  UI.timerLabel.textContent = formatTime(currentSessionSecs);
  UI.totalTimeLabel.textContent = `Total: ${formatTime(totalSecs)}`;
}

function renderBlockedIcons(blockedList) {
  UI.iconContainer.innerHTML = '';

  blockedList.forEach(site => {
    const btn = document.createElement('button');
    btn.className = 'blocked-site-btn';
    btn.title = site;

    const img = document.createElement('img');
    img.src = `https://www.google.com/s2/favicons?sz=64&domain=${site}`;
    img.alt = site;
    img.width = 32;
    img.height = 32;

    const cross = document.createElement('img');
    cross.src = 'close.png';
    cross.className = 'remove-icon';

    btn.append(img, cross);

    btn.addEventListener('click', async () => {
      const { absoluteFocusMode, block = [] } = await chrome.storage.local.get(['absoluteFocusMode', 'block']);

      if (absoluteFocusMode) {
        showTooltip("Can't edit while focusing", 'show');
        return;
      }

      const updatedBlockList = block.filter(s => s !== site);
      await chrome.storage.local.set({ block: updatedBlockList });
      sendToServer('POST', '/url/remove', { url: site });

      btn.remove();
      showTooltip(`"${site}" removed!`, 'remove');

      const hostname = await getActiveHostname();
      if (hostname === site) updateAddButtonUI(hostname, updatedBlockList);
    });

    UI.iconContainer.appendChild(btn);
  });
}

// ============================================================================
// Utilities & API
// ============================================================================

function formatTime(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${String(hours).padStart(2, '0')}h : ${String(minutes).padStart(2, '0')}min`;
}

async function getActiveHostname() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.url ? new URL(tab.url).hostname : null;
}

async function celebrateSession() {
  if (typeof confetti === 'undefined') return;

  const duration = 2000;
  const animationEnd = Date.now() + duration;
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 10000 };

  const interval = setInterval(() => {
    const timeLeft = animationEnd - Date.now();
    if (timeLeft <= 0) return clearInterval(interval);

    const particleCount = 50 * (timeLeft / duration);
    confetti({ ...defaults, particleCount, origin: { x: Math.random() * 0.2 + 0.1, y: Math.random() - 0.2 } });
    confetti({ ...defaults, particleCount, origin: { x: Math.random() * 0.2 + 0.7, y: Math.random() - 0.2 } });
  }, 250);
}

async function sendToServer(method, endpoint, payload) {
  try {
    const { token, isLogged } = await chrome.storage.local.get(['token', 'isLogged']);
    if (!isLogged || !token) return null;

    const res = await fetch(`${SERVER_BASE}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: method !== 'GET' ? JSON.stringify(payload) : undefined
    });

    if (res.status === 401) {
      await chrome.storage.local.set({ isLogged: false });
      return null;
    }

    if (!res.ok) throw new Error(await res.text());
    return method === 'GET' ? await res.json() : true;
  } catch (err) {
    console.error('Server sync failed:', err);
    return null;
  }
}

async function fetchDeviceId() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000); // Prevent hanging on flaky networks

  try {
    const { username } = await chrome.storage.local.get('username');
    const resp = await fetch('http://esp32.local/device-info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    if (!resp.ok) throw new Error('Network response was not ok');
    
    const data = await resp.json();
    if(data.username)
    return data.device_id;
  } catch (err) {
    console.error('Could not reach ESP32:', err.message);
    return null;
  }
}