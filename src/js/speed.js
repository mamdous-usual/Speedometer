/**
 * Speed Processing Module
 * Handles speed conversion, smoothing, and statistics
 * Enhanced with advanced filtering and rate limiting
 */

import { SpeedRateLimiter } from '../utils/kalman.js';

// Constants
const MS_TO_KMH = 3.6;          // Conversion factor: m/s to km/h
const MAX_SPEED_KMH = 200;      // Maximum displayable speed
const MIN_SPEED_KMH = 0;        // Minimum speed

/**
 * Speed smoothing using Exponential Moving Average (EMA)
 * EMA is preferred over Simple Moving Average because it:
 * - Responds faster to recent changes
 * - Requires less memory (no history array needed)
 * - Provides smoother transitions
 */
export class SpeedSmoother {
  /**
   * @param {number} alpha - Smoothing factor (0-1). 
   *                         Higher = more responsive, lower = smoother
   */
  constructor(alpha = 0.3) {
    /** @type {number} Smoothing factor */
    this.alpha = alpha;
    
    /** @type {number|null} Current smoothed value */
    this.smoothedValue = null;
  }

  /**
   * Adds a new speed reading and returns the smoothed value
   * Formula: EMA = α × current + (1 - α) × previous
   * 
   * @param {number} speed - Raw speed value in km/h
   * @returns {number} Smoothed speed value
   */
  update(speed) {
    if (this.smoothedValue === null) {
      // First reading - initialize with raw value
      this.smoothedValue = speed;
    } else {
      // Apply exponential smoothing
      this.smoothedValue = this.alpha * speed + (1 - this.alpha) * this.smoothedValue;
    }
    return this.smoothedValue;
  }

  /**
   * Resets the smoother
   */
  reset() {
    this.smoothedValue = null;
  }

  /**
   * Gets current smoothed value
   * @returns {number}
   */
  getValue() {
    return this.smoothedValue ?? 0;
  }
}

/**
 * Alternative: Simple Moving Average (SMA) Smoother
 * Keeps a fixed-size window of recent readings
 */
export class MovingAverageSmoother {
  /**
   * @param {number} windowSize - Number of readings to average
   */
  constructor(windowSize = 5) {
    /** @type {number} Window size */
    this.windowSize = windowSize;
    
    /** @type {number[]} Circular buffer of recent values */
    this.buffer = [];
    
    /** @type {number} Current index in circular buffer */
    this.index = 0;
    
    /** @type {number} Running sum for efficient average calculation */
    this.sum = 0;
  }

  /**
   * Adds a new speed reading and returns the averaged value
   * @param {number} speed - Raw speed value
   * @returns {number} Averaged speed value
   */
  update(speed) {
    if (this.buffer.length < this.windowSize) {
      // Buffer not full yet
      this.buffer.push(speed);
      this.sum += speed;
    } else {
      // Remove oldest value, add new one
      this.sum -= this.buffer[this.index];
      this.buffer[this.index] = speed;
      this.sum += speed;
      this.index = (this.index + 1) % this.windowSize;
    }
    
    return this.sum / this.buffer.length;
  }

  /**
   * Resets the smoother
   */
  reset() {
    this.buffer = [];
    this.index = 0;
    this.sum = 0;
  }

  /**
   * Gets current average value
   * @returns {number}
   */
  getValue() {
    return this.buffer.length > 0 ? this.sum / this.buffer.length : 0;
  }
}

/**
 * Speed Statistics Tracker
 * Tracks max, average, and other speed metrics
 */
export class SpeedStats {
  constructor() {
    this.reset();
  }

  /**
   * Updates statistics with a new speed reading
   * @param {number} speedKmh - Speed in km/h
   */
  update(speedKmh) {
    // Update max speed
    if (speedKmh > this.maxSpeed) {
      this.maxSpeed = speedKmh;
    }

    // Update running average (using Welford's algorithm for numerical stability)
    this.readingCount++;
    const delta = speedKmh - this.avgSpeed;
    this.avgSpeed += delta / this.readingCount;
  }

  /**
   * Adds distance traveled
   * @param {number} meters - Distance in meters
   */
  addDistance(meters) {
    this.totalDistance += meters;
  }

  /**
   * Gets total distance in kilometers
   * @returns {number}
   */
  getDistanceKm() {
    return this.totalDistance / 1000;
  }

  /**
   * Resets all statistics
   */
  reset() {
    /** @type {number} Maximum speed recorded */
    this.maxSpeed = 0;
    
    /** @type {number} Running average speed */
    this.avgSpeed = 0;
    
    /** @type {number} Number of speed readings */
    this.readingCount = 0;
    
    /** @type {number} Total distance traveled in meters */
    this.totalDistance = 0;
  }
}

/**
 * SpeedProcessor - Main class combining all speed processing
 * Enhanced with rate limiting for smooth display transitions
 */
export class SpeedProcessor {
  /**
   * @param {Object} options - Configuration options
   * @param {number} options.smoothingFactor - EMA smoothing factor (0-1)
   * @param {boolean} options.useEMA - Use EMA (true) or SMA (false)
   * @param {number} options.smaWindowSize - Window size for SMA
   * @param {number} options.maxSpeedChangePerSecond - Max display change rate (km/h per second)
   */
  constructor(options = {}) {
    const {
      smoothingFactor = 0.3,
      useEMA = true,
      smaWindowSize = 5,
      maxSpeedChangePerSecond = 25  // Smooth but responsive
    } = options;

    /** @type {SpeedSmoother|MovingAverageSmoother} */
    this.smoother = useEMA 
      ? new SpeedSmoother(smoothingFactor)
      : new MovingAverageSmoother(smaWindowSize);

    /** @type {SpeedStats} */
    this.stats = new SpeedStats();

    /** @type {Object|null} Previous position for distance calculation */
    this.previousPosition = null;

    /** @type {SpeedRateLimiter} Rate limiter for smooth display */
    this.rateLimiter = new SpeedRateLimiter(maxSpeedChangePerSecond);

    /** @type {number} Last process timestamp */
    this.lastProcessTime = 0;

    /** @type {number} Current target speed (before rate limiting) */
    this.targetSpeed = 0;

    /** @type {number} Current display speed (after rate limiting) */
    this.displaySpeed = 0;
  }

  /**
   * Converts speed from m/s to km/h
   * @param {number} speedMs - Speed in meters per second
   * @returns {number} Speed in km/h
   */
  static convertToKmh(speedMs) {
    return speedMs * MS_TO_KMH;
  }

  /**
   * Clamps speed value to valid range
   * @param {number} speedKmh - Speed in km/h
   * @returns {number} Clamped speed
   */
  static clamp(speedKmh) {
    return Math.max(MIN_SPEED_KMH, Math.min(MAX_SPEED_KMH, speedKmh));
  }

  /**
   * Processes a raw speed reading
   * @param {number} speedMs - Raw speed in m/s from GPS (already Kalman filtered)
   * @param {Object} position - Current position { latitude, longitude }
   * @param {Object} options - Additional options
   * @param {number} options.confidence - GPS confidence 0-1
   * @param {boolean} options.isStable - Whether GPS signal is stable
   * @returns {Object} Processed speed data
   */
  process(speedMs, position = null, options = {}) {
    const { confidence = 1, isStable = true } = options;
    const now = performance.now();
    
    // Convert to km/h
    const rawKmh = SpeedProcessor.convertToKmh(speedMs);
    
    // Apply additional smoothing (GPS already Kalman filtered, this is extra polish)
    // Reduce smoothing factor when confidence is high
    const effectiveAlpha = this.smoother.alpha * (0.5 + confidence * 0.5);
    const originalAlpha = this.smoother.alpha;
    this.smoother.alpha = effectiveAlpha;
    const smoothedKmh = this.smoother.update(rawKmh);
    this.smoother.alpha = originalAlpha;
    
    // Clamp to valid range
    const clampedKmh = SpeedProcessor.clamp(smoothedKmh);
    
    // Set target for rate limiter
    this.targetSpeed = clampedKmh;
    this.rateLimiter.setTarget(clampedKmh);
    
    // Get rate-limited display speed
    this.displaySpeed = this.rateLimiter.update(now);
    
    // Update statistics (use clamped, not rate-limited for accurate stats)
    this.stats.update(clampedKmh);

    // Calculate distance if position provided
    if (position && this.previousPosition) {
      const distance = this._calculateDistance(this.previousPosition, position);
      if (distance > 0 && distance < 1000) { // Sanity check: less than 1km between updates
        this.stats.addDistance(distance);
      }
    }
    
    if (position) {
      this.previousPosition = { ...position };
    }

    this.lastProcessTime = now;

    return {
      raw: rawKmh,
      smoothed: smoothedKmh,
      display: Math.round(this.displaySpeed),
      displayExact: this.displaySpeed,
      target: Math.round(clampedKmh),
      maxSpeed: Math.round(this.stats.maxSpeed),
      avgSpeed: Math.round(this.stats.avgSpeed),
      distanceKm: this.stats.getDistanceKm(),
      confidence,
      isStable
    };
  }

  /**
   * Gets current display speed with rate limiting applied
   * Call this at 60fps for smooth animation updates between GPS readings
   * @returns {number} Current display speed
   */
  getAnimatedSpeed() {
    const now = performance.now();
    this.displaySpeed = this.rateLimiter.update(now);
    return Math.round(this.displaySpeed);
  }

  /**
   * Calculates distance between two positions (simplified, uses Haversine if available)
   * @private
   */
  _calculateDistance(pos1, pos2) {
    // Simple equirectangular approximation (faster than Haversine for small distances)
    const R = 6371000; // Earth's radius in meters
    const lat1 = pos1.latitude * Math.PI / 180;
    const lat2 = pos2.latitude * Math.PI / 180;
    const dLat = lat2 - lat1;
    const dLon = (pos2.longitude - pos1.longitude) * Math.PI / 180;
    
    const x = dLon * Math.cos((lat1 + lat2) / 2);
    const y = dLat;
    
    return Math.sqrt(x * x + y * y) * R;
  }

  /**
   * Resets all processing state and statistics
   */
  reset() {
    this.smoother.reset();
    this.stats.reset();
    this.rateLimiter.reset();
    this.previousPosition = null;
    this.targetSpeed = 0;
    this.displaySpeed = 0;
    this.lastProcessTime = 0;
  }

  /**
   * Gets current smoothed speed
   * @returns {number} Speed in km/h
   */
  getCurrentSpeed() {
    return SpeedProcessor.clamp(this.smoother.getValue());
  }

  /**
   * Gets current display speed (rate-limited)
   * @returns {number} Speed in km/h
   */
  getDisplaySpeed() {
    return Math.round(this.displaySpeed);
  }
}

// Export singleton instance
export const speedProcessor = new SpeedProcessor();
