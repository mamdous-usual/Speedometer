/**
 * Haversine Formula Utility Module
 * Calculates the great-circle distance between two points on Earth
 * Used for manual speed calculation when GPS speed is unavailable
 */

// Earth's radius in meters (mean radius)
const EARTH_RADIUS_M = 6371008.8;

/**
 * Converts degrees to radians
 * @param {number} degrees - Angle in degrees
 * @returns {number} Angle in radians
 */
const toRadians = (degrees) => degrees * (Math.PI / 180);

/**
 * Calculates the Haversine distance between two GPS coordinates
 * 
 * The Haversine formula determines the great-circle distance between
 * two points on a sphere given their longitudes and latitudes.
 * 
 * Formula:
 * a = sin²(Δlat/2) + cos(lat1) × cos(lat2) × sin²(Δlon/2)
 * c = 2 × atan2(√a, √(1−a))
 * d = R × c
 * 
 * @param {number} lat1 - Latitude of first point (degrees)
 * @param {number} lon1 - Longitude of first point (degrees)
 * @param {number} lat2 - Latitude of second point (degrees)
 * @param {number} lon2 - Longitude of second point (degrees)
 * @returns {number} Distance in meters
 */
export function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  // Convert all coordinates to radians
  const φ1 = toRadians(lat1);
  const φ2 = toRadians(lat2);
  const Δφ = toRadians(lat2 - lat1);
  const Δλ = toRadians(lon2 - lon1);

  // Haversine formula components
  const sinHalfΔφ = Math.sin(Δφ / 2);
  const sinHalfΔλ = Math.sin(Δλ / 2);
  
  // a = sin²(Δlat/2) + cos(lat1) × cos(lat2) × sin²(Δlon/2)
  const a = sinHalfΔφ * sinHalfΔφ +
            Math.cos(φ1) * Math.cos(φ2) * sinHalfΔλ * sinHalfΔλ;
  
  // c = 2 × atan2(√a, √(1−a))
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  // d = R × c
  return EARTH_RADIUS_M * c;
}

/**
 * Calculates speed from two position readings using Haversine distance
 * 
 * @param {Object} pos1 - First position { latitude, longitude, timestamp }
 * @param {Object} pos2 - Second position { latitude, longitude, timestamp }
 * @returns {number|null} Speed in m/s, or null if calculation is invalid
 */
export function calculateSpeedFromPositions(pos1, pos2) {
  // Validate inputs
  if (!pos1 || !pos2) return null;
  if (pos1.timestamp >= pos2.timestamp) return null;
  
  // Calculate distance in meters
  const distance = calculateHaversineDistance(
    pos1.latitude, pos1.longitude,
    pos2.latitude, pos2.longitude
  );
  
  // Calculate time difference in seconds
  const timeDiffMs = pos2.timestamp - pos1.timestamp;
  const timeDiffSec = timeDiffMs / 1000;
  
  // Avoid division by zero or very small time intervals
  // (which could produce inaccurate speeds)
  // Lowered threshold from 0.1s to 0.05s to allow faster GPS updates
  if (timeDiffSec < 0.05) return null;
  
  // Speed = distance / time (m/s)
  const speed = distance / timeDiffSec;
  
  // Sanity check: reject unrealistic speeds (> 300 m/s ≈ 1080 km/h)
  if (speed > 300) return null;
  
  return speed;
}

/**
 * Calculates bearing (direction) between two points
 * 
 * @param {number} lat1 - Latitude of first point (degrees)
 * @param {number} lon1 - Longitude of first point (degrees)
 * @param {number} lat2 - Latitude of second point (degrees)
 * @param {number} lon2 - Longitude of second point (degrees)
 * @returns {number} Bearing in degrees (0-360, where 0 = North)
 */
export function calculateBearing(lat1, lon1, lat2, lon2) {
  const φ1 = toRadians(lat1);
  const φ2 = toRadians(lat2);
  const Δλ = toRadians(lon2 - lon1);
  
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) -
            Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  
  let bearing = Math.atan2(y, x) * (180 / Math.PI);
  
  // Normalize to 0-360 degrees
  return (bearing + 360) % 360;
}
