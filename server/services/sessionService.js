const crypto = require('crypto');
const { createSession, getSessionByToken, deleteSession, cleanupExpiredSessions } = require('../database/db');
const logger = require('../utils/logger');

class SessionService {
  /**
   * Generate a secure random token
   * @returns {string} - Random token
   */
  generateToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Create a new session
   * @param {string} userId - User ID
   * @param {Object} options - Session options
   * @returns {Promise<Object>} - Session data with token
   */
  async createSession(userId, options = {}) {
    const token = this.generateToken();
    const expiresInDays = options.rememberMe ? 30 : 7; // 30 days if remember me, 7 days otherwise
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    try {
      await createSession({
        user_id: userId,
        token,
        expires_at: expiresAt.toISOString(),
        ip_address: options.ipAddress || null,
        user_agent: options.userAgent || null
      });

      logger.info(`Session created for user ${userId}`);

      return {
        token,
        expiresAt: expiresAt.toISOString()
      };
    } catch (error) {
      logger.error('Error creating session:', error);
      throw error;
    }
  }

  /**
   * Validate a session token
   * @param {string} token - Session token
   * @returns {Promise<Object|null>} - Session data or null if invalid
   */
  async validateSession(token) {
    if (!token) {
      return null;
    }

    try {
      const session = await getSessionByToken(token);
      
      if (!session) {
        return null;
      }

      // Check if expired
      const expiresAt = new Date(session.expires_at);
      if (expiresAt < new Date()) {
        await this.deleteSession(token);
        return null;
      }

      return session;
    } catch (error) {
      logger.error('Error validating session:', error);
      return null;
    }
  }

  /**
   * Delete a session
   * @param {string} token - Session token
   * @returns {Promise<void>}
   */
  async deleteSession(token) {
    try {
      await deleteSession(token);
      logger.info('Session deleted');
    } catch (error) {
      logger.error('Error deleting session:', error);
      throw error;
    }
  }

  /**
   * Cleanup expired sessions (should be called periodically)
   * @returns {Promise<number>} - Number of sessions deleted
   */
  async cleanupExpiredSessions() {
    try {
      const result = await cleanupExpiredSessions();
      const deleted = result.changes || 0;
      if (deleted > 0) {
        logger.info(`Cleaned up ${deleted} expired sessions`);
      }
      return deleted;
    } catch (error) {
      logger.error('Error cleaning up expired sessions:', error);
      return 0;
    }
  }
}

// Create singleton instance
const sessionService = new SessionService();

// Cleanup expired sessions every hour
setInterval(() => {
  sessionService.cleanupExpiredSessions().catch(err => {
    logger.error('Error in scheduled session cleanup:', err);
  });
}, 60 * 60 * 1000); // Every hour

module.exports = sessionService;

