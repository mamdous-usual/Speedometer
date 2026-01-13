/**
 * GPS Module
 * Handles Geolocation API interactions with watchPosition
 * Enhanced with Kalman filtering and outlier rejection for smooth speed readings
 */

import { calculateSpeedFromPositions, calculateHaversineDistance } from '../utils/haversine.js';
import { GPSKalmanFilter } from '../utils/kalman.js';

/**
 * GPS position callback type
 * @callback PositionCallback
 * @param {Object} data - Position data
 * @param {number} data.speed - Speed in m/s (filtered)
 * @param {number} data.rawSpeed - Raw speed in m/s (unfiltered)
 * @param {number} data.accuracy - GPS accuracy in meters
 * @param {number} data.latitude - Current latitude
 * @param {number} data.longitude - Current longitude
 * @param {number} data.timestamp - Position timestamp
 * @param {boolean} data.isCalculated - Whether speed was calculated via Haversine
 * @param {number} data.confidence - Confidence level 0-1
 * @param {boolean} data.isStable - Whether signal is stable
 */

/**
 * GPS error callback type
 * @callback ErrorCallback
 * @param {string} message - Error message
 * @param {number} code - Error code
 */

/**
 * GPS Manager Class
 * Manages geolocation tracking with Kalman filtering and advanced noise rejection
 */
export class GPSManager {
  constructor() {
    /** @type {number|null} Watch position ID */
    this.watchId = null;
    
    /** @type {Object|null} Previous position for speed calculation */
    this.previousPosition = null;
    
    /** @type {PositionCallback|null} Success callback */
    this.onPosition = null;
    
    /** @type {ErrorCallback|null} Error callback */
    this.onError = null;
    
    /** @type {boolean} Whether GPS is currently active */
    this.isActive = false;
    
    /** @type {number} Minimum time between position updates (ms) */
    this.minUpdateInterval = 200; // Faster updates for smoother experience
    
    /** @type {number} Last position update timestamp */
    this.lastUpdateTime = 0;
    
    // Kalman filter for GPS data
    /** @type {GPSKalmanFilter} */
    this.kalmanFilter = new GPSKalmanFilter();
    
    // Warm-up state - need stable readings before showing speed
    /** @type {number} Number of readings received */
    this.readingCount = 0;
    
    /** @type {number} Minimum readings before showing speed */
    this.warmupReadings = 3;
    
    /** @type {boolean} Whether warm-up is complete */
    this.isWarmedUp = false;
    
    // Position history for advanced filtering
    /** @type {Array} Recent positions */
    this.positionHistory = [];
    
    /** @type {number} Max positions to keep */
    this.maxHistorySize = 5;
    
    // Minimum movement threshold (meters) - ignore GPS drift
    /** @type {number} */
    this.minMovementThreshold = 1;
    
    // Geolocation options optimized for speedometer use
    this.geoOptions = {
      enableHighAccuracy: true,  // Use GPS hardware when available
      timeout: 10000,            // 10 second timeout
      maximumAge: 0              // Always get fresh position
    };
  }

  /**
   * Checks if Geolocation API is supported
   * @returns {boolean}
   */
  static isSupported() {
    return 'geolocation' in navigator;
  }

  /**
   * Gets current position once (useful for permission check)
   * @returns {Promise<GeolocationPosition>}
   */
  static getCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (!GPSManager.isSupported()) {
        reject(new Error('Geolocation not supported'));
        return;
      }
      
      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0
        }
      );
    });
  }

  /**
   * Starts GPS tracking
   * @param {PositionCallback} onPosition - Called on each position update
   * @param {ErrorCallback} onError - Called on errors
   * @returns {boolean} True if started successfully
   */
  start(onPosition, onError) {
    if (!GPSManager.isSupported()) {
      onError?.('Geolocation is not supported by your browser', 0);
      return false;
    }

    if (this.isActive) {
      console.warn('[GPS] Already active');
      return true;
    }

    this.onPosition = onPosition;
    this.onError = onError;
    this.previousPosition = null;
    this.lastUpdateTime = 0;
    
    // Reset filtering state
    this.kalmanFilter.reset();
    this.readingCount = 0;
    this.isWarmedUp = false;
    this.positionHistory = [];

    try {
      // Start watching position
      this.watchId = navigator.geolocation.watchPosition(
        this._handlePosition.bind(this),
        this._handleError.bind(this),
        this.geoOptions
      );

      this.isActive = true;
      console.log('[GPS] Started tracking with Kalman filtering');
      return true;
    } catch (error) {
      onError?.(`Failed to start GPS: ${error.message}`, -1);
      return false;
    }
  }

  /**
   * Stops GPS tracking
   */
  stop() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    
    this.isActive = false;
    this.previousPosition = null;
    this.kalmanFilter.reset();
    this.readingCount = 0;
    this.isWarmedUp = false;
    this.positionHistory = [];
    console.log('[GPS] Stopped tracking');
  }

  /**
   * Handles incoming position updates with advanced filtering
   * @private
   * @param {GeolocationPosition} position
   */
  _handlePosition(position) {
    const now = Date.now();
    const coords = position.coords;
    
    // Throttle updates
    if (now - this.lastUpdateTime < this.minUpdateInterval) {
      return;
    }
    this.lastUpdateTime = now;

    // Build position data object
    const currentPosition = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      timestamp: position.timestamp,
      accuracy: coords.accuracy
    };

    // Add to position history
    this.positionHistory.push(currentPosition);
    if (this.positionHistory.length > this.maxHistorySize) {
      this.positionHistory.shift();
    }

    // Increment reading count for warm-up
    this.readingCount++;

    let rawSpeed = coords.speed; // Speed from GPS (m/s), can be null
    let isCalculated = false;

    // If GPS doesn't provide speed, calculate using Haversine
    if (rawSpeed === null || rawSpeed === undefined) {
      if (this.previousPosition) {
        const calculatedSpeed = calculateSpeedFromPositions(
          this.previousPosition,
          currentPosition
        );
        
        if (calculatedSpeed !== null) {
          rawSpeed = calculatedSpeed;
          isCalculated = true;
        } else {
          rawSpeed = 0;
        }
      } else {
        rawSpeed = 0;
      }
    }

    // Check minimum movement threshold to avoid GPS drift showing as movement
    let actuallyMoving = true;
    if (this.previousPosition) {
      const distance = calculateHaversineDistance(
        this.previousPosition.latitude,
        this.previousPosition.longitude,
        currentPosition.latitude,
        currentPosition.longitude
      );
      
      // Only consider not moving if GPS speed is also very low AND distance is tiny
      // Don't aggressively zero out - let Kalman filter handle noise
      if (distance < 1 && rawSpeed < 0.5) { // Less than 1m moved AND < 1.8 km/h
        actuallyMoving = false;
        rawSpeed = 0;
      }
    }

    // Apply Kalman filter for smooth, reliable speed
    const filterResult = this.kalmanFilter.process({
      speed: rawSpeed,
      accuracy: coords.accuracy,
      timestamp: position.timestamp
    });

    // Track warm-up state but don't dampen speed - show real speed immediately
    let filteredSpeed = filterResult.filteredSpeed;
    let confidence = filterResult.confidence;
    
    if (!this.isWarmedUp) {
      if (this.readingCount >= this.warmupReadings) {
        this.isWarmedUp = true;
        console.log('[GPS] Warm-up complete, signal stabilized');
      }
      // During warm-up, still show speed but mark as less stable
      confidence = Math.min(confidence, 0.7);
    }

    // Update previous position for next calculation
    this.previousPosition = currentPosition;

    // Call the position callback with processed data
    this.onPosition?.({
      speed: Math.max(0, filteredSpeed),
      rawSpeed: rawSpeed,
      accuracy: coords.accuracy,
      latitude: coords.latitude,
      longitude: coords.longitude,
      altitude: coords.altitude,
      heading: coords.heading,
      timestamp: position.timestamp,
      isCalculated,
      confidence,
      isStable: this.isWarmedUp && filterResult.isValid && !filterResult.isOutlier,
      isMoving: actuallyMoving
    });
  }

  /**
   * Handles geolocation errors
   * @private
   * @param {GeolocationPositionError} error
   */
  _handleError(error) {
    let message;
    
    switch (error.code) {
      case error.PERMISSION_DENIED:
        message = 'Location permission denied. Please enable location access.';
        break;
      case error.POSITION_UNAVAILABLE:
        message = 'Location information unavailable. Make sure GPS is enabled.';
        break;
      case error.TIMEOUT:
        message = 'Location request timed out. Please try again.';
        break;
      default:
        message = `Unknown error: ${error.message}`;
    }

    console.error('[GPS] Error:', message);
    this.onError?.(message, error.code);
  }

  /**
   * Requests permission and gets a single position
   * Useful for initial permission check
   * @returns {Promise<GeolocationPosition>}
   */
  static getCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (!GPSManager.isSupported()) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });
  }
}

// Export singleton instance for convenience
export const gpsManager = new GPSManager();
