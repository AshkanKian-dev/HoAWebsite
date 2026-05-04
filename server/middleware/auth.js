const sessionService = require('../services/sessionService');
const { getUserById } = require('../database/db');
const logger = require('../utils/logger');

/**
 * Authentication middleware
 * Verifies the session token and attaches user to request
 */
async function authenticate(req, res, next) {
  try {
    // Get token from Authorization header or cookie only (not query string for security)
    const token = req.headers.authorization?.replace('Bearer ', '') || 
                  req.cookies?.authToken;

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Validate session
    const session = await sessionService.validateSession(token);
    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Get user info
    const user = await getUserById(session.user_id);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Check if user is banned
    if (user.banned === 1) {
      return res.status(403).json({ error: 'Account is banned' });
    }

    // Attach user and session to request
    req.user = {
      userId: user.user_id,
      email: user.email,
      characterName: user.character_name,
      steamId: user.steam_id,
      displayName: user.display_name,
      isAdmin: user.is_admin === 1
    };
    req.session = session;

    next();
  } catch (error) {
    logger.error('Authentication middleware error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
}

/**
 * Optional authentication middleware
 * Attaches user if token is valid, but doesn't require it
 */
async function optionalAuth(req, res, next) {
  try {
    // Get token from Authorization header or cookie only (not query string for security)
    const token = req.headers.authorization?.replace('Bearer ', '') || 
                  req.cookies?.authToken;

    if (token) {
      const session = await sessionService.validateSession(token);
      if (session) {
        const user = await getUserById(session.user_id);
        if (user) {
          req.user = {
            userId: user.user_id,
            email: user.email,
            characterName: user.character_name,
            steamId: user.steam_id,
            displayName: user.display_name,
            isAdmin: user.is_admin === 1
          };
          req.session = session;
        }
      }
    }

    next();
  } catch (error) {
    // Don't fail on optional auth errors
    logger.debug('Optional auth error:', error);
    next();
  }
}

/**
 * Require admin access middleware
 * Must be used after authenticate middleware
 */
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!req.user.isAdmin) {
    logger.warn(`Unauthorized admin access attempt by user ${req.user.userId}`);
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
}

module.exports = {
  authenticate,
  optionalAuth,
  requireAdmin
};

