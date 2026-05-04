const logger = require('./logger');
const fs = require('fs');
const path = require('path');

// Create security log file transport
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const securityLogger = {
  /**
   * Log a security event
   * @param {string} event - Event type (e.g., 'failed_login', 'account_locked')
   * @param {Object} details - Event details
   */
  logSecurityEvent(event, details = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      ...details
    };

    // Log to main logger
    logger.warn(`Security Event: ${event}`, logEntry);

    // Also write to security-specific log file
    const securityLogPath = path.join(logsDir, 'security.log');
    const logLine = JSON.stringify(logEntry) + '\n';
    fs.appendFileSync(securityLogPath, logLine, { flag: 'a' });
  },

  /**
   * Log failed login attempt
   */
  logFailedLogin(email, ip, reason = 'Invalid credentials') {
    this.logSecurityEvent('failed_login', {
      email,
      ip,
      reason
    });
  },

  /**
   * Log successful login
   */
  logSuccessfulLogin(email, ip) {
    this.logSecurityEvent('successful_login', {
      email,
      ip
    });
  },

  /**
   * Log account lockout
   */
  logAccountLocked(email, ip, reason) {
    this.logSecurityEvent('account_locked', {
      email,
      ip,
      reason
    });
  },

  /**
   * Log account unlock
   */
  logAccountUnlocked(email, ip) {
    this.logSecurityEvent('account_unlocked', {
      email,
      ip
    });
  },

  /**
   * Log suspicious activity
   */
  logSuspiciousActivity(description, details = {}) {
    this.logSecurityEvent('suspicious_activity', {
      description,
      ...details
    });
  },

  /**
   * Log authentication failure
   */
  logAuthFailure(reason, ip, details = {}) {
    this.logSecurityEvent('auth_failure', {
      reason,
      ip,
      ...details
    });
  },

  /**
   * Log privilege escalation attempt
   */
  logPrivilegeEscalation(userId, ip, action) {
    this.logSecurityEvent('privilege_escalation_attempt', {
      userId,
      ip,
      action
    });
  }
};

module.exports = securityLogger;

