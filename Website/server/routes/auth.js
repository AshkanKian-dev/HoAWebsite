const express = require('express');
const router = express.Router();
const { createUser, getUserByEmail, getUserById, updateUserLastLogin, updateUserPassword, createPasswordResetToken, getPasswordResetToken, markPasswordResetTokenAsUsed, db: rawDb } = require('../database/db');
const { hashPassword, comparePassword, validatePasswordStrength } = require('../utils/password');
const sessionService = require('../services/sessionService');
const emailService = require('../services/emailService');
const { authenticate } = require('../middleware/auth');
const config = require('../config/config');
const { apiRateLimiter, validateInput, validateEmail, validateCharacterName } = require('../middleware/security');
const { checkBruteForce, logSuccessfulLogin, logFailedLogin } = require('../middleware/bruteForce');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

/**
 * Register a new user
 */
router.post('/register', 
  apiRateLimiter,
  validateInput,
  validateEmail,
  validateCharacterName,
  async (req, res, next) => {
    try {
      const { email, password, characterName, steamId, displayName } = req.body;

      // Validate required fields
      if (!email || !password || !characterName) {
        return res.status(400).json({ error: 'Email, password, and character name are required' });
      }

      // Validate password strength
      const passwordValidation = validatePasswordStrength(password);
      if (!passwordValidation.isValid) {
        return res.status(400).json({ 
          error: 'Password does not meet requirements',
          details: passwordValidation.errors
        });
      }

      // Check if email already exists
      const existingUser = await getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      // Validate Steam ID format if provided
      if (steamId && !/^[0-9]{17}$/.test(steamId)) {
        return res.status(400).json({ error: 'Invalid Steam ID format (must be 17 digits)' });
      }

      // Hash password
      const passwordHash = await hashPassword(password);

      // Create user
      await createUser({
        email: email.toLowerCase().trim(),
        password_hash: passwordHash,
        character_name: characterName.trim(),
        steam_id: steamId || null,
        display_name: displayName ? displayName.trim() : null
      });

      logger.info(`New user registered: ${email}`);

      res.status(201).json({
        success: true,
        message: 'Account created successfully'
      });

    } catch (error) {
      logger.error('Registration error:', error);
      next(error);
    }
  }
);

/**
 * Login user
 */
router.post('/login',
  apiRateLimiter,
  validateInput,
  validateEmail,
  checkBruteForce,
  async (req, res, next) => {
    try {
      const { email, password, rememberMe } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      // Get user by email
      const user = await getUserByEmail(email.toLowerCase().trim());
      if (!user) {
        logFailedLogin(email, ipAddress, 'User not found');
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Check if user is banned
      if (user.banned === 1) {
        logFailedLogin(email, ipAddress, 'Banned account attempted login');
        return res.status(403).json({ error: 'Account is banned' });
      }

      // Verify password
      const passwordMatch = await comparePassword(password, user.password_hash);
      if (!passwordMatch) {
        logFailedLogin(email, ipAddress, 'Invalid password');
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Update last login
      await updateUserLastLogin(user.user_id);

      // Create session
      const session = await sessionService.createSession(user.user_id, {
        rememberMe: rememberMe === true,
        ipAddress: ipAddress,
        userAgent: req.get('user-agent')
      });

      // Log successful login
      logSuccessfulLogin(email, ipAddress);
      logger.info(`User logged in: ${email}`);

      // Set secure HTTP-only cookie for token (additional security layer)
      const isProduction = process.env.NODE_ENV === 'production';
      res.cookie('authToken', session.token, {
        httpOnly: true,
        secure: isProduction, // Only send over HTTPS in production
        sameSite: 'strict',
        maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000 // 30 days or 7 days
      });

      // Return user info (without password hash) and token
      res.json({
        success: true,
        token: session.token,
        user: {
          userId: user.user_id,
          email: user.email,
          characterName: user.character_name,
          steamId: user.steam_id,
          displayName: user.display_name,
          emailVerified: user.email_verified === 1
        }
      });

    } catch (error) {
      logger.error('Login error:', error);
      next(error);
    }
  }
);

/**
 * Logout user
 */
router.post('/logout', async (req, res, next) => {
  try {
    // Only accept token from Authorization header or cookie (not body or query string)
    const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.authToken;

    if (token) {
      await sessionService.deleteSession(token);
      logger.info('User logged out');
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    logger.error('Logout error:', error);
    next(error);
  }
});

/**
 * Get current user info
 */
router.get('/me', async (req, res, next) => {
  try {
    // Only accept token from Authorization header or cookie (not query string)
    const token = req.headers.authorization?.replace('Bearer ', '') || 
                  req.cookies?.authToken;

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Validate session
    const session = await sessionService.validateSession(token);
    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Get user info
    const user = await getUserById(session.user_id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      user: {
        userId: user.user_id,
        email: user.email,
        characterName: user.character_name,
        steamId: user.steam_id,
        displayName: user.display_name,
        emailVerified: user.email_verified === 1,
        createdAt: user.created_at,
        lastLogin: user.last_login
      }
    });

  } catch (error) {
    logger.error('Get user error:', error);
    next(error);
  }
});

/**
 * Request password reset (forgot password)
 */
router.post('/forgot-password',
  apiRateLimiter,
  validateInput,
  validateEmail,
  async (req, res, next) => {
    try {
      const { email } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress;

      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      // Get user by email
      const user = await getUserByEmail(email.toLowerCase().trim());
      
      // Always return success to prevent email enumeration
      // Don't reveal whether the email exists or not
      if (!user) {
        logger.warn(`Password reset requested for non-existent email: ${email} from IP: ${ipAddress}`);
        // Return success message even if user doesn't exist (security best practice)
        return res.json({
          success: true,
          message: 'If an account with that email exists, a password reset link has been sent.'
        });
      }

      // Generate secure reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      // Create password reset token in database
      await createPasswordResetToken(user.user_id, resetToken, expiresAt.toISOString());

      // Generate reset URL - use frontend URL from config or construct from request
      const frontendUrl = process.env.FRONTEND_URL || 
                         (req.headers.origin || config.server.apiBaseUrl.replace('/api', ''));
      const resetUrl = `${frontendUrl}/reset-password.html?token=${resetToken}`;

      // Send password reset email
      const emailSent = await emailService.sendPasswordResetEmail(user.email, resetToken, resetUrl);

      if (!emailSent) {
        logger.error(`Failed to send password reset email to ${user.email}`);
        // Still return success to user (don't reveal email service issues)
      }

      logger.info(`Password reset requested for user: ${user.email} from IP: ${ipAddress}`);

      res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      });

    } catch (error) {
      logger.error('Forgot password error:', error);
      // Still return success to prevent information leakage
      res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    }
  }
);

/**
 * Reset password with token
 */
router.post('/reset-password',
  apiRateLimiter,
  validateInput,
  async (req, res, next) => {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({ error: 'Token and new password are required' });
      }

      // Validate password strength
      const passwordValidation = validatePasswordStrength(newPassword);
      if (!passwordValidation.isValid) {
        return res.status(400).json({
          error: 'Password does not meet requirements',
          details: passwordValidation.errors
        });
      }

      // Get reset token from database
      const resetTokenData = await getPasswordResetToken(token);
      
      if (!resetTokenData) {
        return res.status(400).json({ error: 'Invalid or expired reset token' });
      }

      // Hash new password
      const passwordHash = await hashPassword(newPassword);

      // Update user password
      await updateUserPassword(resetTokenData.user_id, passwordHash);

      // Mark token as used
      await markPasswordResetTokenAsUsed(token);

      // Invalidate all user sessions (force re-login)
      const { deleteUserSessions } = require('../database/db');
      await deleteUserSessions(resetTokenData.user_id);

      logger.info(`Password reset successful for user: ${resetTokenData.email}`);

      res.json({
        success: true,
        message: 'Password has been reset successfully. Please log in with your new password.'
      });

    } catch (error) {
      logger.error('Reset password error:', error);
      next(error);
    }
  }
);

/**
 * DELETE /api/auth/account — GDPR account deletion
 * Deletes the authenticated user's account and anonymises their purchase records.
 * Completed within 30 days as required by GDPR (happens immediately here).
 */
router.delete('/account',
  apiRateLimiter,
  require('../middleware/auth').authenticate,
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const userEmail = req.user.email;

      // Anonymise purchase records so financial history is retained without PII
      rawDb.prepare(`
        UPDATE purchases
        SET customer_email = 'deleted@deleted.invalid',
            character_name = 'deleted',
            steam_id       = NULL,
            metadata       = NULL
        WHERE customer_email = ?
      `).run(userEmail);

      // Delete sessions, forum content, and the user row (cascades via FK)
      rawDb.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
      rawDb.prepare('DELETE FROM forum_posts WHERE user_id = ?').run(userId);
      rawDb.prepare('DELETE FROM forum_topics WHERE user_id = ?').run(userId);
      rawDb.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(userId);
      rawDb.prepare('DELETE FROM users WHERE user_id = ?').run(userId);

      logger.info(`Account deleted (GDPR request): ${userId}`);

      // Send confirmation email (best-effort — don't fail the response if it errors)
      try {
        await emailService.sendEmail({
          to: userEmail,
          subject: 'Your Heart of Acheron account has been deleted',
          html: `<p>Your account and personal data have been deleted as requested. Purchase records have been anonymised for financial compliance.</p><p>If you did not request this, please contact us immediately.</p>`
        });
      } catch (_) { /* email failure is non-fatal */ }

      res.json({ success: true, message: 'Account deleted. Your personal data has been removed.' });
    } catch (error) {
      logger.error('Account deletion error:', error);
      next(error);
    }
  }
);

module.exports = router;

