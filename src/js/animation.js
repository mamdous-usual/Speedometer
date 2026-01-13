/**
 * Animation Module
 * Handles smooth speedometer needle animation using requestAnimationFrame
 * Renders the gauge on HTML Canvas for optimal performance
 * Supports OneDark theme (light and dark modes)
 */

/**
 * Gets computed CSS custom property value
 * @param {string} property - CSS custom property name
 * @returns {string} Property value
 */
function getCSSVar(property) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(property);
  return value ? value.trim() : '';
}

/**
 * SpeedometerRenderer - Renders the speedometer gauge on canvas
 */
export class SpeedometerRenderer {
  /**
   * @param {HTMLCanvasElement} canvas - Canvas element to render on
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    
    // Configuration - Full circle gauge (360 degrees)
    this.config = {
      minSpeed: 0,
      maxSpeed: 200,
      startAngle: -225,         // Start at bottom-left (7 o'clock position)
      endAngle: 45,             // End at bottom-right (5 o'clock position) - 270° sweep
      tickMajorCount: 10,       // Major tick marks (every 20 km/h)
      tickMinorCount: 4,        // Minor ticks between major ticks
    };

    // Current and target needle position
    this.currentAngle = this._speedToAngle(0);
    this.targetAngle = this._speedToAngle(0);
    
    // Animation state
    this.animationFrameId = null;
    this.lastFrameTime = 0;
    
    // Needle animation settings - smoother interpolation
    this.needleLerpFactor = 0.08;  // Smoother interpolation (was 0.15)
    this.needleMinSpeed = 0.05;    // Minimum movement per frame to prevent jitter
    
    // Update colors from CSS
    this._updateColors();
    
    // Setup high-DPI canvas
    this._setupCanvas();
  }

  /**
   * Updates colors from CSS custom properties (for theme support)
   */
  _updateColors() {
    // Check if we're in light mode
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    
    // Light theme fallbacks
    const lightDefaults = {
      background: '#fafafa',
      gaugeTrack: '#d3d3d4',
      gaugeLow: '#50a14f',
      gaugeMid: '#c18401',
      gaugeHigh: '#e45649',
      needle: '#383a42',
      needleCenter: '#4078f2',
      tickMajor: '#232529',
      tickMinor: '#a0a1a7',
      text: '#696c77'
    };
    
    // Dark theme fallbacks
    const darkDefaults = {
      background: '#282c34',
      gaugeTrack: '#3e4451',
      gaugeLow: '#98c379',
      gaugeMid: '#e5c07b',
      gaugeHigh: '#e06c75',
      needle: '#abb2bf',
      needleCenter: '#61afef',
      tickMajor: '#d7dae0',
      tickMinor: '#5c6370',
      text: '#7f848e'
    };
    
    const defaults = isLight ? lightDefaults : darkDefaults;
    
    this.colors = {
      background: getCSSVar('--color-bg-primary') || defaults.background,
      gaugeTrack: getCSSVar('--gauge-track') || defaults.gaugeTrack,
      gaugeLow: getCSSVar('--gauge-low') || defaults.gaugeLow,
      gaugeMid: getCSSVar('--gauge-mid') || defaults.gaugeMid,
      gaugeHigh: getCSSVar('--gauge-high') || defaults.gaugeHigh,
      needle: getCSSVar('--gauge-needle') || defaults.needle,
      needleCenter: getCSSVar('--gauge-needle-center') || defaults.needleCenter,
      tickMajor: getCSSVar('--color-text-bright') || defaults.tickMajor,
      tickMinor: getCSSVar('--color-text-muted') || defaults.tickMinor,
      text: getCSSVar('--color-text-secondary') || defaults.text
    };
  }

  /**
   * Refreshes colors (call when theme changes)
   */
  refreshTheme() {
    this._updateColors();
    this._render();
  }

  /**
   * Sets up canvas for high-DPI displays
   * @private
   */
  _setupCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    
    // Set actual canvas size
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    
    // Scale context to match DPR
    this.ctx.scale(dpr, dpr);
    
    // Store logical dimensions
    this.width = rect.width;
    this.height = rect.height;
    this.centerX = this.width / 2;
    this.centerY = this.height / 2;
    this.radius = Math.min(this.width, this.height) * 0.42;
  }

  /**
   * Converts speed value to needle angle
   * @private
   * @param {number} speed - Speed in km/h
   * @returns {number} Angle in degrees
   */
  _speedToAngle(speed) {
    const clampedSpeed = Math.max(this.config.minSpeed, Math.min(this.config.maxSpeed, speed));
    const speedRange = this.config.maxSpeed - this.config.minSpeed;
    const angleRange = this.config.endAngle - this.config.startAngle;
    
    return this.config.startAngle + (clampedSpeed / speedRange) * angleRange;
  }

  /**
   * Converts degrees to radians
   * @private
   */
  _toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Gets color based on speed zone
   * @private
   */
  _getSpeedColor(speed) {
    if (speed <= 60) return this.colors.gaugeLow;
    if (speed <= 120) return this.colors.gaugeMid;
    return this.colors.gaugeHigh;
  }

  /**
   * Draws the gauge background and arc track
   * @private
   */
  _drawGaugeBackground() {
    const ctx = this.ctx;
    const { startAngle, endAngle } = this.config;
    
    // Draw outer arc track
    ctx.beginPath();
    ctx.arc(
      this.centerX, this.centerY,
      this.radius,
      this._toRadians(startAngle),
      this._toRadians(endAngle)
    );
    ctx.strokeStyle = this.colors.gaugeTrack;
    ctx.lineWidth = 20;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  /**
   * Draws colored speed zones on the gauge
   * @private
   */
  _drawSpeedZones() {
    const ctx = this.ctx;
    
    // Zone definitions: [start%, end%, color]
    const zones = [
      [0, 0.30, this.colors.gaugeLow],    // 0-60 km/h
      [0.30, 0.60, this.colors.gaugeMid], // 60-120 km/h
      [0.60, 1.0, this.colors.gaugeHigh]  // 120-200 km/h
    ];
    
    const angleRange = this.config.endAngle - this.config.startAngle;
    
    zones.forEach(([startPct, endPct, color]) => {
      const zoneStart = this.config.startAngle + angleRange * startPct;
      const zoneEnd = this.config.startAngle + angleRange * endPct;
      
      ctx.beginPath();
      ctx.arc(
        this.centerX, this.centerY,
        this.radius - 25,
        this._toRadians(zoneStart),
        this._toRadians(zoneEnd)
      );
      ctx.strokeStyle = color;
      ctx.lineWidth = 6;
      ctx.globalAlpha = 0.4;
      ctx.stroke();
      ctx.globalAlpha = 1;
    });
  }

  /**
   * Draws tick marks around the gauge
   * @private
   */
  _drawTicks() {
    const ctx = this.ctx;
    const { tickMajorCount, tickMinorCount, startAngle, endAngle, minSpeed, maxSpeed } = this.config;
    const angleRange = endAngle - startAngle;
    
    for (let i = 0; i <= tickMajorCount; i++) {
      const angle = this._toRadians(startAngle + (i / tickMajorCount) * angleRange);
      
      // Major tick
      const majorInner = this.radius - 30;
      const majorOuter = this.radius - 10;
      
      ctx.beginPath();
      ctx.moveTo(
        this.centerX + majorInner * Math.cos(angle),
        this.centerY + majorInner * Math.sin(angle)
      );
      ctx.lineTo(
        this.centerX + majorOuter * Math.cos(angle),
        this.centerY + majorOuter * Math.sin(angle)
      );
      ctx.strokeStyle = this.colors.tickMajor;
      ctx.lineWidth = 3;
      ctx.stroke();
      
      // Speed label - positioned outside the gauge
      const speed = minSpeed + (i / tickMajorCount) * (maxSpeed - minSpeed);
      const labelRadius = this.radius + 15;
      const labelX = this.centerX + labelRadius * Math.cos(angle);
      const labelY = this.centerY + labelRadius * Math.sin(angle);
      
      ctx.font = 'bold 11px -apple-system, sans-serif';
      ctx.fillStyle = this.colors.text;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(Math.round(speed).toString(), labelX, labelY);
      
      // Minor ticks (between major ticks)
      if (i < tickMajorCount) {
        const segmentAngle = angleRange / tickMajorCount;
        for (let j = 1; j <= tickMinorCount; j++) {
          const minorAngle = this._toRadians(
            startAngle + (i / tickMajorCount) * angleRange + 
            (j / (tickMinorCount + 1)) * segmentAngle
          );
          
          const minorInner = this.radius - 22;
          const minorOuter = this.radius - 12;
          
          ctx.beginPath();
          ctx.moveTo(
            this.centerX + minorInner * Math.cos(minorAngle),
            this.centerY + minorInner * Math.sin(minorAngle)
          );
          ctx.lineTo(
            this.centerX + minorOuter * Math.cos(minorAngle),
            this.centerY + minorOuter * Math.sin(minorAngle)
          );
          ctx.strokeStyle = this.colors.tickMinor;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
    }
  }

  /**
   * Draws the needle at the current angle
   * @private
   */
  _drawNeedle() {
    const ctx = this.ctx;
    const angle = this._toRadians(this.currentAngle);
    
    // Needle reaches from center area to near the tick marks
    const needleLength = this.radius - 35;
    const needleStartRadius = this.radius * 0.25; // Start from center area (not exact center)
    const needleWidth = 5;
    
    // Calculate needle points
    const tipX = this.centerX + needleLength * Math.cos(angle);
    const tipY = this.centerY + needleLength * Math.sin(angle);
    
    const baseX = this.centerX + needleStartRadius * Math.cos(angle);
    const baseY = this.centerY + needleStartRadius * Math.sin(angle);
    
    // Perpendicular offset for needle width at base
    const perpAngle = angle + Math.PI / 2;
    const offsetX = needleWidth * Math.cos(perpAngle);
    const offsetY = needleWidth * Math.sin(perpAngle);
    
    // Draw needle shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    
    // Draw needle body (triangle shape from base to tip)
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(baseX + offsetX, baseY + offsetY);
    ctx.lineTo(baseX - offsetX, baseY - offsetY);
    ctx.closePath();
    
    // Needle color - use accent color
    ctx.fillStyle = this.colors.gaugeHigh;
    ctx.fill();
    
    ctx.restore();
  }

  /**
   * Draws the digital speed readout in the center of the gauge
   * @private
   */
  _drawCenterDigitalReadout() {
    const ctx = this.ctx;
    
    // Calculate current speed from angle
    const angleRange = this.config.endAngle - this.config.startAngle;
    const speedRange = this.config.maxSpeed - this.config.minSpeed;
    const currentSpeed = Math.round(
      ((this.currentAngle - this.config.startAngle) / angleRange) * speedRange
    );
    
    // Speed value - large digital display
    ctx.font = `bold ${this.radius * 0.28}px -apple-system, sans-serif`;
    ctx.fillStyle = this.colors.tickMajor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(Math.max(0, currentSpeed).toString(), this.centerX, this.centerY - 5);
    
    // Unit label - smaller below
    ctx.font = `600 ${this.radius * 0.10}px -apple-system, sans-serif`;
    ctx.fillStyle = this.colors.text;
    ctx.fillText('km/h', this.centerX, this.centerY + this.radius * 0.18);
  }

  /**
   * Renders a complete frame
   * @private
   */
  _render() {
    const ctx = this.ctx;
    
    // Clear canvas
    ctx.clearRect(0, 0, this.width, this.height);
    
    // Draw gauge components
    this._drawGaugeBackground();
    this._drawSpeedZones();
    this._drawTicks();
    this._drawNeedle();
    this._drawCenterDigitalReadout();
  }

  /**
   * Animation loop using requestAnimationFrame
   * Enhanced with smoother easing and continuous animation
   * @private
   */
  _animate(timestamp) {
    // Smooth interpolation towards target angle
    const diff = this.targetAngle - this.currentAngle;
    
    // Use a threshold that prevents micro-jitter but allows smooth movement
    if (Math.abs(diff) > this.needleMinSpeed) {
      // Apply smooth easing with variable lerp based on distance
      // Faster when far from target, slower when close (feels more natural)
      const dynamicLerp = this.needleLerpFactor * (1 + Math.abs(diff) / 100);
      const clampedLerp = Math.min(dynamicLerp, 0.2); // Cap for stability
      
      this.currentAngle += diff * clampedLerp;
      
      // Render frame
      this._render();
      
      // Continue animation loop
      this.animationFrameId = requestAnimationFrame(this._animate.bind(this));
    } else {
      // Needle very close to target - snap and stop animating to save CPU
      this.currentAngle = this.targetAngle;
      this._render();
      this.animationFrameId = null;
    }
  }

  /**
   * Starts the animation loop
   */
  start() {
    // Just render initial frame, don't start continuous loop
    this._render();
  }

  /**
   * Starts animation towards target (called when speed changes)
   * @private
   */
  _startAnimation() {
    if (this.animationFrameId === null) {
      this.animationFrameId = requestAnimationFrame(this._animate.bind(this));
    }
  }

  /**
   * Stops the animation loop
   */
  stop() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Updates the target speed (triggers smooth needle animation)
   * @param {number} speed - Target speed in km/h
   */
  setSpeed(speed) {
    this.targetAngle = this._speedToAngle(speed);
    this._startAnimation();
  }

  /**
   * Immediately sets needle position without animation
   * @param {number} speed - Speed in km/h
   */
  setSpeedImmediate(speed) {
    const angle = this._speedToAngle(speed);
    this.currentAngle = angle;
    this.targetAngle = angle;
    this._render();
  }

  /**
   * Handles canvas resize
   */
  resize() {
    this._setupCanvas();
    this._render();
  }

  /**
   * Resets needle to zero position
   */
  reset() {
    this.setSpeedImmediate(0);
  }
}

/**
 * Creates and manages the speedometer animation
 * @param {HTMLCanvasElement} canvas 
 * @returns {SpeedometerRenderer}
 */
export function createSpeedometerRenderer(canvas) {
  const renderer = new SpeedometerRenderer(canvas);
  
  // Handle window resize
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => renderer.resize(), 100);
  });
  
  // Handle orientation change
  window.addEventListener('orientationchange', () => {
    setTimeout(() => renderer.resize(), 200);
  });
  
  return renderer;
}
