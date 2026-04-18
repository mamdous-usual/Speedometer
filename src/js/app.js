/**
 * Speedometer - Main Application Entry Point
 * Coordinates all modules and manages application lifecycle
 * Supports analog/digital views and OneDark theme (dark/light)
 */

import { GPSManager } from './gps.js';
import { SpeedProcessor } from './speed.js';
import { createSpeedometerRenderer } from './animation.js';
import * as UI from './ui.js';

/**
 * Application State
 */
const state = {
  isRunning: false,
  gpsManager: null,
  speedProcessor: null,
  speedometerRenderer: null,
  wakeLock: null
};

/**
 * Initializes the application
 */
async function initApp() {
  console.log('[App] Initializing Speedometer...');
  
  // Initialize UI (including theme and view setup)
  UI.initUI();
  UI.resetUI();
  UI.setupOfflineListeners();
  UI.restoreViewPreference();
  
  // Initialize GPS Manager
  state.gpsManager = new GPSManager();
  
  // Initialize Speed Processor - lighter smoothing since GPS is already Kalman filtered
  state.speedProcessor = new SpeedProcessor({
    smoothingFactor: 0.6,      // Higher = more responsive to real movement (GPS already filtered)
    useEMA: true,
    maxSpeedChangePerSecond: 50  // Allow faster changes for better responsiveness
  });
  
  // Initialize Speedometer Renderer (analog view)
  const canvas = document.getElementById('speedometer-canvas');
  if (canvas) {
    state.speedometerRenderer = createSpeedometerRenderer(canvas);
    state.speedometerRenderer.setSpeedImmediate(0);
    state.speedometerRenderer.start();
  }
  
  // Handle theme changes - refresh canvas colors
  UI.onThemeChanged((theme) => {
    console.log('[App] Theme changed to:', theme);
    if (state.speedometerRenderer) {
      // Delay to let CSS variables fully update
      requestAnimationFrame(() => {
        state.speedometerRenderer.refreshTheme();
      });
    }
  });
  
  // Setup button handlers
  UI.setupButtonHandlers({
    onStart: handleStartStop,
    onReset: handleReset
  });
  
  // Register Service Worker for PWA
  await registerServiceWorker();
  
  // Check for Geolocation support
  if (!GPSManager.isSupported()) {
    UI.showMessage('Geolocation is not supported by your browser', 0);
    UI.setGPSStatus('error');
    const startBtn = UI.getElement('btnStart');
    if (startBtn) startBtn.disabled = true;
  }
  
  console.log('[App] Initialization complete');
}

/**
 * Registers the Service Worker for offline support
 */
async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      // Use absolute path for reliable registration
      const swPath = '/public/sw.js';
      const registration = await navigator.serviceWorker.register(swPath, {
        scope: '/'
      });
      
      console.log('[App] Service Worker registered:', registration.scope);
      
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            UI.showMessage('New version available! Refresh to update.', 10000);
          }
        });
      });
    } catch (error) {
      console.error('[App] Service Worker registration failed:', error);
    }
  }
}

/**
 * Handles start/stop button click
 */
function handleStartStop() {
  if (state.isRunning) {
    stopTracking();
  } else {
    startTracking();
  }
}

/**
 * Starts GPS tracking
 */
async function startTracking() {
  if (state.isRunning) return;
  
  console.log('[App] Starting GPS tracking...');
  UI.showMessage('Requesting location access...', 0);
  UI.setGPSStatus('waiting');
  
  // Check if we can get a position first (triggers permission prompt)
  try {
    await GPSManager.getCurrentPosition();
    console.log('[App] Location permission granted');
  } catch (error) {
    console.error('[App] Location permission error:', error);
    UI.setGPSStatus('error');
    
    if (error.code === 1) {
      UI.showMessage('Location permission denied. Please allow location access in your browser settings.', 5000);
    } else if (error.code === 2) {
      UI.showMessage('Cannot get location. Please enable GPS/Location Services.', 5000);
    } else if (error.code === 3) {
      UI.showMessage('Location request timed out. Please try again.', 5000);
    } else {
      UI.showMessage('Location error: ' + error.message, 5000);
    }
    return;
  }
  
  // Request wake lock to keep screen on
  state.wakeLock = await UI.requestWakeLock();
  
  // Start GPS
  const success = state.gpsManager.start(
    handlePositionUpdate,
    handleGPSError
  );
  
  if (success) {
    state.isRunning = true;
    UI.setStartButtonState(true);
    UI.setResetButtonEnabled(true);
    UI.setGPSStatus('active');
    UI.showMessage('GPS tracking started. Move around to see speed.', 3000);
  }
}

/**
 * Stops GPS tracking
 */
function stopTracking() {
  if (!state.isRunning) return;
  
  console.log('[App] Stopping GPS tracking...');
  
  state.gpsManager.stop();
  state.isRunning = false;
  
  // Release wake lock
  if (state.wakeLock) {
    state.wakeLock.release().catch(() => {});
    state.wakeLock = null;
  }
  
  UI.setStartButtonState(false);
  UI.setGPSStatus('inactive');
  UI.showMessage('GPS tracking stopped', 2000);
}

/**
 * Handles incoming GPS position updates
 * @param {Object} data - Position data from GPS module (already Kalman filtered)
 */
function handlePositionUpdate(data) {
  // Debug logging - remove in production
  const speedKmh = (data.speed * 3.6).toFixed(1);
  console.log(`[Speed] Raw: ${(data.rawSpeed * 3.6).toFixed(1)} km/h | Filtered: ${speedKmh} km/h | Accuracy: ${data.accuracy.toFixed(0)}m | Calculated: ${data.isCalculated ? 'YES (Haversine)' : 'NO (GPS provided)'}`);
  
  if (speedKmh > 0) {
    console.log(`[App] ✓ Speed detected: ${speedKmh} km/h`);
  }
  
  // Process speed through smoother with confidence info
  const processed = state.speedProcessor.process(
    data.speed, 
    {
      latitude: data.latitude,
      longitude: data.longitude
    },
    {
      confidence: data.confidence || 1,
      isStable: data.isStable !== false
    }
  );
  
  // Update speedometer animation (analog view)
  if (state.speedometerRenderer) {
    state.speedometerRenderer.setSpeed(processed.display);
  }
  
  // Update UI displays (both views)
  UI.updateSpeedDisplay(processed.display);
  UI.updateStats({
    maxSpeed: processed.maxSpeed,
    avgSpeed: processed.avgSpeed,
    distanceKm: processed.distanceKm
  });
  UI.updateAccuracy(data.accuracy);
  
  // Update GPS status based on accuracy and stability
  if (data.accuracy > 50) {
    UI.setGPSStatus('error');
  } else if (!data.isStable) {
    UI.setGPSStatus('waiting');
  } else {
    UI.setGPSStatus('active');
  }
}

/**
 * Handles GPS errors
 * @param {string} message - Error message
 * @param {number} code - Error code
 */
function handleGPSError(message, code) {
  console.error('[App] GPS Error:', message, code);
  
  UI.setGPSStatus('error');
  UI.showMessage(message, 5000);
  
  if (code === 1) { // PERMISSION_DENIED
    stopTracking();
    UI.setResetButtonEnabled(false);
  }
}

/**
 * Handles reset button click
 */
function handleReset() {
  console.log('[App] Resetting...');
  
  if (state.isRunning) {
    stopTracking();
  }
  
  // Reset speed processor
  state.speedProcessor.reset();
  
  // Reset speedometer
  if (state.speedometerRenderer) {
    state.speedometerRenderer.reset();
  }
  
  // Reset UI
  UI.updateSpeedDisplay(0);
  UI.updateStats({ maxSpeed: 0, avgSpeed: 0, distanceKm: 0 });
  UI.updateAccuracy(null);
  UI.setResetButtonEnabled(false);
  UI.showMessage('Statistics reset', 2000);
}

/**
 * Cleanup on page unload
 */
function cleanup() {
  if (state.isRunning) {
    state.gpsManager.stop();
  }
  if (state.speedometerRenderer) {
    state.speedometerRenderer.stop();
  }
  if (state.wakeLock) {
    state.wakeLock.release().catch(() => {});
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// Cleanup on page unload
window.addEventListener('beforeunload', cleanup);
window.addEventListener('pagehide', cleanup);

// Handle visibility change
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.isRunning) {
    console.log('[App] App in background');
  } else if (!document.hidden && state.isRunning) {
    console.log('[App] App in foreground');
  }
});
