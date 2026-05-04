const bcrypt = require('bcrypt');

// Password hashing configuration
const SALT_ROUNDS = 12;

/**
 * Hash a password using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} - Hashed password
 */
async function hashPassword(password) {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }
  
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compare a plain text password with a hash
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @returns {Promise<boolean>} - True if passwords match
 */
async function comparePassword(password, hash) {
  if (!password || !hash) {
    return false;
  }
  
  return bcrypt.compare(password, hash);
}

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {Object} - Validation result with isValid and errors
 */
function validatePasswordStrength(password) {
  const errors = [];
  
  if (!password) {
    errors.push('Password is required');
    return { isValid: false, errors };
  }
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (password.length > 128) {
    errors.push('Password must be less than 128 characters');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  // Optional: require special character
  // if (!/[^a-zA-Z0-9]/.test(password)) {
  //   errors.push('Password must contain at least one special character');
  // }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

module.exports = {
  hashPassword,
  comparePassword,
  validatePasswordStrength
};

