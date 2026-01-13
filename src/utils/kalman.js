/**
 * Kalman Filter for GPS Speed Smoothing
 * 
 * A 1D Kalman filter optimized for GPS speed data.
 * Much better than EMA for GPS noise because it:
 * - Adapts to measurement quality (GPS accuracy)
 * - Predicts next value based on velocity trends
 * - Handles variable update rates
 * - Rejects outliers naturally
 */

/**
 * 1D Kalman Filter for speed smoothing
 * Optimized for GPS speedometer use
 */
export class KalmanFilter {
  /**
   * @param {Object} options - Configuration options
   * @param {number} options.processNoise - Process noise (Q) - how much we expect speed to change
   * @param {number} options.measurementNoise - Measurement noise (R) - GPS noise level
   * @param {number} options.estimatedError - Initial estimation error (P)
   */
  constructor(options = {}) {
    const {
      processNoise = 0.5,      // Q: Expect speed changes up to 0.5 m/s² acceleration
      measurementNoise = 3,     // R: GPS typically has ~3 m/s noise
      estimatedError = 10       // P: Initial uncertainty
    } = options;

    /** @type {number} Process noise covariance */
    this.Q = processNoise;
    
    /** @type {number} Measurement noise covariance */
    this.R = measurementNoise;
    
    /** @type {number} Estimation error covariance */
    this.P = estimatedError;
    
    /** @type {number|null} Current state estimate */
    this.x = null;
    
    /** @type {number} Kalman gain */
    this.K = 0;
    
    /** @type {number} Last update timestamp */
    this.lastTimestamp = 0;
  }

  /**
   * Updates the filter with a new measurement
   * 
   * @param {number} measurement - New speed measurement (m/s or km/h)
   * @param {number} measurementNoise - Optional per-reading noise (from GPS accuracy)
   * @param {number} timestamp - Optional timestamp for adaptive process noise
   * @returns {number} Filtered speed value
   */
  update(measurement, measurementNoise = null, timestamp = null) {
    // Use provided measurement noise or default
    const R = measurementNoise !== null ? measurementNoise : this.R;
    
    // Adjust process noise based on time delta (if timestamp provided)
    let Q = this.Q;
    if (timestamp && this.lastTimestamp > 0) {
      const dt = (timestamp - this.lastTimestamp) / 1000; // seconds
      // More time passed = more potential for speed change
      Q = this.Q * Math.max(1, dt);
    }
    if (timestamp) {
      this.lastTimestamp = timestamp;
    }

    if (this.x === null) {
      // First measurement - initialize
      this.x = measurement;
      this.P = R;
      return this.x;
    }

    // Prediction step
    // State prediction: x_predicted = x (assuming constant speed model)
    // Error prediction: P_predicted = P + Q
    const P_predicted = this.P + Q;

    // Update step
    // Kalman gain: K = P_predicted / (P_predicted + R)
    this.K = P_predicted / (P_predicted + R);

    // State update: x = x + K * (measurement - x)
    this.x = this.x + this.K * (measurement - this.x);

    // Error update: P = (1 - K) * P_predicted
    this.P = (1 - this.K) * P_predicted;

    return this.x;
  }

  /**
   * Gets current estimated value without updating
   * @returns {number}
   */
  getValue() {
    return this.x ?? 0;
  }

  /**
   * Gets current Kalman gain (useful for debugging)
   * Higher K = trusting measurements more
   * Lower K = trusting predictions more
   * @returns {number}
   */
  getGain() {
    return this.K;
  }

  /**
   * Resets the filter
   */
  reset() {
    this.x = null;
    this.P = 10;
    this.K = 0;
    this.lastTimestamp = 0;
  }
}

/**
 * Advanced GPS Position Kalman Filter
 * Tracks position + velocity for better predictions
 */
export class GPSKalmanFilter {
  constructor() {
    /** @type {KalmanFilter} Speed filter */
    this.speedFilter = new KalmanFilter({
      processNoise: 1.0,        // Higher = trust new measurements more
      measurementNoise: 0.5,    // Lower = trust GPS speed more
      estimatedError: 5
    });

    /** @type {number[]} Recent speed readings for outlier detection */
    this.recentSpeeds = [];
    
    /** @type {number} Max readings to keep */
    this.maxReadings = 10;

    /** @type {number} Max allowed speed change per second (m/s²) */
    this.maxAcceleration = 20; // ~2g - very generous for vehicles

    /** @type {number|null} Last valid speed */
    this.lastValidSpeed = null;

    /** @type {number} Last update timestamp */
    this.lastTimestamp = 0;
  }

  /**
   * Processes a GPS reading with full filtering pipeline
   * 
   * @param {Object} reading - GPS reading
   * @param {number} reading.speed - Speed in m/s
   * @param {number} reading.accuracy - GPS accuracy in meters
   * @param {number} reading.timestamp - Reading timestamp
   * @returns {Object} Processed result
   */
  process(reading) {
    const { speed, accuracy, timestamp } = reading;
    
    const result = {
      rawSpeed: speed,
      filteredSpeed: speed,
      isValid: true,
      isOutlier: false,
      confidence: 1,
      reason: 'ok'
    };

    // Step 1: Accuracy-based confidence adjustment (don't reject, just reduce confidence)
    // Only reject extremely poor accuracy
    if (accuracy > 100) {
      result.isValid = false;
      result.confidence = 0.2;
      result.reason = 'very_poor_accuracy';
      // Use last known speed instead
      result.filteredSpeed = this.speedFilter.getValue();
      return result;
    }

    // Step 2: Outlier detection using acceleration limits
    if (this.lastValidSpeed !== null && this.lastTimestamp > 0) {
      const timeDelta = (timestamp - this.lastTimestamp) / 1000; // seconds
      
      if (timeDelta > 0 && timeDelta < 30) { // Ignore if too long gap
        const speedChange = Math.abs(speed - this.lastValidSpeed);
        const maxChange = this.maxAcceleration * timeDelta;
        
        if (speedChange > maxChange) {
          result.isOutlier = true;
          result.confidence = 0.3;
          result.reason = 'acceleration_exceeded';
          
          // Clamp to maximum possible change
          const direction = speed > this.lastValidSpeed ? 1 : -1;
          const clampedSpeed = this.lastValidSpeed + (direction * maxChange);
          result.filteredSpeed = this.speedFilter.update(
            clampedSpeed,
            this._accuracyToNoise(accuracy) * 2, // Increase noise for outliers
            timestamp
          );
          
          this.lastTimestamp = timestamp;
          return result;
        }
      }
    }

    // Step 3: Calculate measurement noise from GPS accuracy
    // Better accuracy = lower noise = trust measurement more
    const measurementNoise = this._accuracyToNoise(accuracy);

    // Step 4: Apply Kalman filter
    result.filteredSpeed = this.speedFilter.update(speed, measurementNoise, timestamp);
    
    // Step 5: Update state
    this.lastValidSpeed = result.filteredSpeed;
    this.lastTimestamp = timestamp;
    
    // Store for statistics
    this.recentSpeeds.push(speed);
    if (this.recentSpeeds.length > this.maxReadings) {
      this.recentSpeeds.shift();
    }

    // Calculate confidence based on accuracy and filter convergence
    result.confidence = Math.min(1, Math.max(0.5, 1 - (accuracy / 100)));

    return result;
  }

  /**
   * Converts GPS accuracy to measurement noise
   * @private
   */
  _accuracyToNoise(accuracy) {
    // Higher accuracy = lower noise
    // Typical: 5m accuracy → noise 0.5, 20m accuracy → noise 2
    // Lower values = trust GPS more
    return Math.max(0.3, accuracy / 10);
  }

  /**
   * Gets current filtered speed
   * @returns {number}
   */
  getSpeed() {
    return this.speedFilter.getValue();
  }

  /**
   * Resets the filter
   */
  reset() {
    this.speedFilter.reset();
    this.recentSpeeds = [];
    this.lastValidSpeed = null;
    this.lastTimestamp = 0;
  }
}

/**
 * Speed Rate Limiter
 * Prevents display from changing too fast regardless of input
 */
export class SpeedRateLimiter {
  /**
   * @param {number} maxChangePerSecond - Maximum speed change per second (km/h/s)
   */
  constructor(maxChangePerSecond = 50) {  // 50 km/h per second max change
    /** @type {number} Max change rate */
    this.maxChangePerSecond = maxChangePerSecond;
    
    /** @type {number} Current displayed speed */
    this.currentSpeed = 0;
    
    /** @type {number} Target speed */
    this.targetSpeed = 0;
    
    /** @type {number} Last update time */
    this.lastUpdateTime = 0;
  }

  /**
   * Sets the target speed
   * @param {number} speed - Target speed in km/h
   */
  setTarget(speed) {
    this.targetSpeed = speed;
  }

  /**
   * Updates and returns the rate-limited speed
   * Call this at 60fps for smooth animation
   * @param {number} timestamp - Current timestamp (performance.now() or Date.now())
   * @returns {number} Rate-limited speed
   */
  update(timestamp) {
    if (this.lastUpdateTime === 0) {
      this.lastUpdateTime = timestamp;
      this.currentSpeed = this.targetSpeed;
      return this.currentSpeed;
    }

    const deltaTime = (timestamp - this.lastUpdateTime) / 1000; // seconds
    this.lastUpdateTime = timestamp;

    const diff = this.targetSpeed - this.currentSpeed;
    const maxChange = this.maxChangePerSecond * deltaTime;

    if (Math.abs(diff) <= maxChange) {
      this.currentSpeed = this.targetSpeed;
    } else {
      this.currentSpeed += Math.sign(diff) * maxChange;
    }

    return this.currentSpeed;
  }

  /**
   * Gets current speed
   * @returns {number}
   */
  getSpeed() {
    return this.currentSpeed;
  }

  /**
   * Resets the limiter
   */
  reset() {
    this.currentSpeed = 0;
    this.targetSpeed = 0;
    this.lastUpdateTime = 0;
  }
}
