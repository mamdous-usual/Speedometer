/**
 * UI Module
 * Handles all DOM interactions and UI updates
 * Supports analog/digital views and dark/light theme toggle
 */

/**
 * DOM element references cache
 */
const elements = {
  // Views
  analogView: null,
  digitalView: null,
  statsPanel: null,
  
  // Digital displays
  digitalSpeedValue: null,
  digitalMaxSpeed: null,
  digitalAvgSpeed: null,
  digitalDistance: null,
  
  // Stats (analog view)
  maxSpeed: null,
  avgSpeed: null,
  totalDistance: null,
  
  // Status indicators
  gpsStatus: null,
  accuracyBadge: null,
  accuracyValue: null,
  
  // Controls
  btnStart: null,
  btnReset: null,
  btnAnalog: null,
  btnDigital: null,
  btnTheme: null,
  
  // Messages
  messageContainer: null,
  messageText: null,
  
  // Offline indicator
  offlineIndicator: null
};

/** Current view state */
let currentView = 'analog';

/** Theme change callback */
let onThemeChange = null;

/**
 * Initializes UI element references
 */
export function initUI() {
  // Views
  elements.analogView = document.getElementById('analog-view');
  elements.digitalView = document.getElementById('digital-view');
  elements.statsPanel = document.getElementById('stats-panel');
  
  // Digital displays
  elements.digitalSpeedValue = document.getElementById('digital-speed-value');
  elements.digitalMaxSpeed = document.getElementById('digital-max-speed');
  elements.digitalAvgSpeed = document.getElementById('digital-avg-speed');
  elements.digitalDistance = document.getElementById('digital-distance');
  
  // Stats
  elements.maxSpeed = document.getElementById('max-speed');
  elements.avgSpeed = document.getElementById('avg-speed');
  elements.totalDistance = document.getElementById('total-distance');
  
  // Status
  elements.gpsStatus = document.getElementById('gps-status');
  elements.accuracyBadge = document.getElementById('accuracy-badge');
  elements.accuracyValue = elements.accuracyBadge?.querySelector('.accuracy-value');
  
  // Controls
  elements.btnStart = document.getElementById('btn-start');
  elements.btnReset = document.getElementById('btn-reset');
  elements.btnAnalog = document.getElementById('btn-analog');
  elements.btnDigital = document.getElementById('btn-digital');
  elements.btnTheme = document.getElementById('btn-theme');
  
  // Messages
  elements.messageContainer = document.getElementById('message-container');
  elements.messageText = document.getElementById('message-text');
  
  // Offline
  elements.offlineIndicator = document.getElementById('offline-indicator');
  
  // Initialize theme from localStorage or system preference
  initTheme();
  
  // Setup view toggle handlers
  setupViewToggle();
  
  // Setup theme toggle handler
  setupThemeToggle();
}

/**
 * Initializes theme from stored preference or system preference
 */
function initTheme() {
  const stored = localStorage.getItem('speedometer-theme');
  if (stored) {
    setTheme(stored);
  } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
    setTheme('light');
  } else {
    setTheme('dark');
  }
  
  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('speedometer-theme')) {
      setTheme(e.matches ? 'dark' : 'light');
    }
  });
}

/**
 * Sets the theme
 * @param {'dark' | 'light'} theme
 */
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('speedometer-theme', theme);
  
  // Update theme-color meta tag
  const themeColor = theme === 'dark' ? '#282c34' : '#fafafa';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor);
  
  // Notify callback
  if (onThemeChange) {
    onThemeChange(theme);
  }
}

/**
 * Gets current theme
 * @returns {'dark' | 'light'}
 */
export function getTheme() {
  return document.documentElement.getAttribute('data-theme') || 'dark';
}

/**
 * Toggles between light and dark theme
 */
function toggleTheme() {
  const current = getTheme();
  setTheme(current === 'dark' ? 'light' : 'dark');
}

/**
 * Sets up theme toggle button handler
 */
function setupThemeToggle() {
  if (elements.btnTheme) {
    elements.btnTheme.addEventListener('click', toggleTheme);
  }
}

/**
 * Registers a callback for theme changes
 * @param {Function} callback
 */
export function onThemeChanged(callback) {
  onThemeChange = callback;
}

/**
 * Sets up view toggle button handlers
 */
function setupViewToggle() {
  if (elements.btnAnalog) {
    elements.btnAnalog.addEventListener('click', () => setView('analog'));
  }
  if (elements.btnDigital) {
    elements.btnDigital.addEventListener('click', () => setView('digital'));
  }
}

/**
 * Sets the current view (analog or digital)
 * @param {'analog' | 'digital'} view
 */
export function setView(view) {
  currentView = view;
  
  // Update button states
  elements.btnAnalog?.classList.toggle('active', view === 'analog');
  elements.btnDigital?.classList.toggle('active', view === 'digital');
  
  // Show/hide views
  elements.analogView?.classList.toggle('hidden', view !== 'analog');
  elements.digitalView?.classList.toggle('hidden', view !== 'digital');
  
  // Show stats panel only in analog view
  elements.statsPanel?.classList.toggle('hidden', view !== 'analog');
  
  // Store preference
  localStorage.setItem('speedometer-view', view);
}

/**
 * Gets current view
 * @returns {'analog' | 'digital'}
 */
export function getView() {
  return currentView;
}

/**
 * Updates speed displays (both analog and digital)
 * @param {number} speed - Speed in km/h
 */
export function updateSpeedDisplay(speed) {
  const displaySpeed = Math.round(Math.max(0, speed));
  
  // Update digital display
  if (elements.digitalSpeedValue) {
    // Pad with leading zeros for digital display
    elements.digitalSpeedValue.textContent = displaySpeed.toString().padStart(3, '0');
  }
}

/**
 * Updates statistics display (both analog and digital views)
 * @param {Object} stats
 */
export function updateStats(stats) {
  const maxSpeed = Math.round(stats.maxSpeed).toString();
  const avgSpeed = Math.round(stats.avgSpeed).toString();
  const distance = stats.distanceKm.toFixed(2);
  
  // Analog view stats
  if (elements.maxSpeed) {
    elements.maxSpeed.textContent = maxSpeed;
  }
  if (elements.avgSpeed) {
    elements.avgSpeed.textContent = avgSpeed;
  }
  if (elements.totalDistance) {
    elements.totalDistance.textContent = distance;
  }
  
  // Digital view stats
  if (elements.digitalMaxSpeed) {
    elements.digitalMaxSpeed.textContent = maxSpeed;
  }
  if (elements.digitalAvgSpeed) {
    elements.digitalAvgSpeed.textContent = avgSpeed;
  }
  if (elements.digitalDistance) {
    elements.digitalDistance.textContent = distance;
  }
}

/**
 * Updates GPS status indicator
 * @param {'inactive' | 'active' | 'error'} status
 */
export function setGPSStatus(status) {
  if (elements.gpsStatus) {
    elements.gpsStatus.dataset.status = status;
    
    const statusText = elements.gpsStatus.querySelector('.status-text');
    if (statusText) {
      switch (status) {
        case 'active':
          statusText.textContent = 'GPS';
          break;
        case 'error':
          statusText.textContent = 'GPS!';
          break;
        default:
          statusText.textContent = 'GPS';
      }
    }
  }
}

/**
 * Updates GPS accuracy display
 * @param {number|null} accuracy
 */
export function updateAccuracy(accuracy) {
  if (elements.accuracyValue) {
    if (accuracy !== null && accuracy !== undefined) {
      elements.accuracyValue.textContent = Math.round(accuracy).toString();
    } else {
      elements.accuracyValue.textContent = '--';
    }
  }
}

/**
 * Updates start button state
 * @param {boolean} isStarted
 */
export function setStartButtonState(isStarted) {
  if (elements.btnStart) {
    const btnIcon = elements.btnStart.querySelector('.btn-icon');
    const btnText = elements.btnStart.querySelector('.btn-text');
    
    if (isStarted) {
      if (btnIcon) btnIcon.textContent = '⏹';
      if (btnText) btnText.textContent = 'Stop';
      elements.btnStart.classList.remove('btn-primary');
      elements.btnStart.classList.add('btn-secondary');
    } else {
      if (btnIcon) btnIcon.textContent = '▶';
      if (btnText) btnText.textContent = 'Start';
      elements.btnStart.classList.add('btn-primary');
      elements.btnStart.classList.remove('btn-secondary');
    }
  }
}

/**
 * Sets reset button enabled state
 * @param {boolean} enabled
 */
export function setResetButtonEnabled(enabled) {
  if (elements.btnReset) {
    elements.btnReset.disabled = !enabled;
  }
}

/**
 * Shows a message to the user
 * @param {string} message
 * @param {number} duration - Auto-hide duration in ms (0 = no auto-hide)
 */
export function showMessage(message, duration = 5000) {
  if (elements.messageContainer && elements.messageText) {
    elements.messageText.textContent = message;
    elements.messageContainer.hidden = false;
    
    if (duration > 0) {
      setTimeout(() => hideMessage(), duration);
    }
  }
}

/**
 * Hides the message container
 */
export function hideMessage() {
  if (elements.messageContainer) {
    elements.messageContainer.hidden = true;
  }
}

/**
 * Shows or hides the offline indicator
 * @param {boolean} isOffline
 */
export function setOfflineIndicator(isOffline) {
  if (elements.offlineIndicator) {
    elements.offlineIndicator.hidden = !isOffline;
  }
}

/**
 * Sets up button click handlers
 * @param {Object} handlers
 */
export function setupButtonHandlers(handlers) {
  if (elements.btnStart && handlers.onStart) {
    elements.btnStart.addEventListener('click', handlers.onStart);
  }
  
  if (elements.btnReset && handlers.onReset) {
    elements.btnReset.addEventListener('click', handlers.onReset);
  }
}

/**
 * Resets all UI elements to initial state
 */
export function resetUI() {
  updateSpeedDisplay(0);
  updateStats({ maxSpeed: 0, avgSpeed: 0, distanceKm: 0 });
  updateAccuracy(null);
  setGPSStatus('inactive');
  setStartButtonState(false);
  setResetButtonEnabled(false);
  hideMessage();
  
  // Reset digital bar
  if (elements.digitalBarFill) {
    elements.digitalBarFill.style.width = '0%';
  }
}

/**
 * Sets up online/offline event listeners
 */
export function setupOfflineListeners() {
  window.addEventListener('online', () => {
    setOfflineIndicator(false);
  });
  
  window.addEventListener('offline', () => {
    setOfflineIndicator(true);
  });
  
  if (!navigator.onLine) {
    setOfflineIndicator(true);
  }
}

/**
 * Prevents screen from going to sleep
 * @returns {Promise<Object|null>}
 */
export async function requestWakeLock() {
  if ('wakeLock' in navigator) {
    try {
      const wakeLock = await navigator.wakeLock.request('screen');
      console.log('[UI] Wake lock acquired');
      
      document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible') {
          try {
            await navigator.wakeLock.request('screen');
          } catch (e) {
            console.warn('[UI] Wake lock re-acquisition failed');
          }
        }
      });
      
      return wakeLock;
    } catch (err) {
      console.warn('[UI] Wake lock failed:', err);
    }
  }
  return null;
}

/**
 * Gets a reference to a specific element
 * @param {string} key
 * @returns {HTMLElement|null}
 */
export function getElement(key) {
  return elements[key] || null;
}

/**
 * Restores saved view preference
 */
export function restoreViewPreference() {
  const savedView = localStorage.getItem('speedometer-view');
  if (savedView === 'digital' || savedView === 'analog') {
    setView(savedView);
  }
}
