const { getRecentFailedAttempts, isAccountLocked, createLoginAttempt } = require('../database/db');
const securityLogger = require('../utils/securityLogger');
const logger = require('../utils/logger');

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

/**
 * Brute force protection middleware
 * Tracks failed login attempts and locks accounts after too many failures
 */
async function checkBruteForce(req, res, next) {
  const email = req.body.email;
  const ipAddress = req.ip || req.connection.remoteAddress;

  if (!email) {
    return next();
  }

  try {
    // Check if account is currently locked
    const lockedUntil = isAccountLocked(email);
    if (lockedUntil) {
      const minutesRemaining = Math.ceil((lockedUntil - new Date()) / 1000 / 60);
      securityLogger.logAccountLocked(email, ipAddress, 'Account is locked');
      return res.status(429).json({
        error: 'Account temporarily locked due to too many failed login attempts',
        lockedUntil: lockedUntil.toISOString(),
        minutesRemaining
      });
    }

    // Check recent failed attempts
    const recentFailures = getRecentFailedAttempts(email, ipAddress, LOCKOUT_DURATION_MINUTES);
    const failureCount = recentFailures ? recentFailures.count : 0;

    if (failureCount >= MAX_FAILED_ATTEMPTS) {
      // Lock the account
      const { lockAccount } = require('../database/db');
      lockAccount(email, LOCKOUT_DURATION_MINUTES);
      
      securityLogger.logAccountLocked(email, ipAddress, `Too many failed attempts: ${failureCount}`);
      
      return res.status(429).json({
        error: 'Too many failed login attempts. Account locked for 15 minutes.',
        lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000).toISOString()
      });
    }

    // Store attempt count in request for logging
    req.loginAttemptCount = failureCount;
    next();
  } catch (error) {
    logger.error('Brute force check error:', error);
    // Don't block on error, but log it
    next();
  }
}

/**
 * Log successful login and clear failed attempts
 */
function logSuccessfulLogin(email, ipAddress) {
  try {
    createLoginAttempt(email, ipAddress, true);
    const { clearFailedAttempts } = require('../database/db');
    clearFailedAttempts(email);
    securityLogger.logSuccessfulLogin(email, ipAddress);
  } catch (error) {
    logger.error('Error logging successful login:', error);
  }
}

/**
 * Log failed login attempt
 */
function logFailedLogin(email, ipAddress, reason = 'Invalid credentials') {
  try {
    createLoginAttempt(email, ipAddress, false);
    securityLogger.logFailedLogin(email, ipAddress, reason);
  } catch (error) {
    logger.error('Error logging failed login:', error);
  }
}

module.exports = {
  checkBruteForce,
  logSuccessfulLogin,
  logFailedLogin
};

