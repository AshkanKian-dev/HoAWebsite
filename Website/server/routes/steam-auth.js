const express = require('express');
const passport = require('passport');
const SteamStrategy = require('passport-steam').Strategy;
const db = require('../database/db');
const logger = require('../utils/logger');
const sessionService = require('../services/sessionService');

const router = express.Router();

const STEAM_RETURN_URL = process.env.STEAM_RETURN_URL || 'http://localhost:3000/api/auth/steam/callback';
const STEAM_REALM = process.env.STEAM_REALM || 'http://localhost:3000';
const STEAM_API_KEY = process.env.STEAM_API_KEY || '';

// Passport Steam strategy
passport.use(new SteamStrategy(
  {
    returnURL: STEAM_RETURN_URL,
    realm: STEAM_REALM,
    apiKey: STEAM_API_KEY
  },
  async (identifier, profile, done) => {
    try {
      const steamId = profile.id;
      const displayName = profile.displayName || null;
      const avatar = profile.photos && profile.photos[2]
        ? profile.photos[2].value   // full-size avatar
        : (profile.photos && profile.photos[0] ? profile.photos[0].value : null);

      // Find existing user by steam_id
      let user = db.getUserBySteamId(steamId);

      if (user) {
        // Update avatar/display name on each login
        db.db.prepare(
          'UPDATE users SET steam_avatar = ?, display_name = ?, last_login = CURRENT_TIMESTAMP WHERE user_id = ?'
        ).run(avatar, displayName, user.user_id);
        user = db.getUserById(user.user_id);
      } else {
        // Create a new account linked to this Steam ID
        const newUserId = db.createUser({
          email: `steam_${steamId}@steam.local`,
          password_hash: null,          // no password — Steam-only account
          character_name: displayName || `Player_${steamId.slice(-6)}`,
          steam_id: steamId,
          steam_avatar: avatar,
          display_name: displayName,
          is_admin: 0
        });
        user = db.getUserById(newUserId);
        logger.info(`New Steam account created: ${steamId} (${displayName})`);
      }

      return done(null, user);
    } catch (err) {
      logger.error('Steam auth error:', err);
      return done(err, null);
    }
  }
));

// Passport session stubs — we use JWT, not persistent passport sessions
passport.serializeUser((user, done) => done(null, user.user_id));
passport.deserializeUser((id, done) => {
  try {
    const user = db.getUserById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

// Redirect user to Steam login
router.get('/steam', passport.authenticate('steam', { failureRedirect: '/client/pages/login.html' }));

// Steam redirects back here after login
router.get(
  '/steam/callback',
  passport.authenticate('steam', { failureRedirect: '/client/pages/login.html?error=steam_failed' }),
  async (req, res) => {
    try {
      const user = req.user;

      // Issue a session token so the frontend behaves the same as email/password login
      const session = await sessionService.createSession(user.user_id, {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
      const token = session.token;

      // Redirect to profile with token in URL fragment (never in query string)
      // The frontend reads it from the fragment and stores in localStorage
      const returnUrl = req.query.return || '/client/pages/profile.html';
      res.redirect(`${returnUrl}#steam_token=${token}`);
    } catch (err) {
      logger.error('Steam callback error:', err);
      res.redirect('/client/pages/login.html?error=steam_callback_failed');
    }
  }
);

// GET /api/auth/steam/profile — return current user's Steam info (JWT required)
router.get('/steam/profile', require('../middleware/auth').authenticate, (req, res) => {
  const user = db.getUserById(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({
    steamId: user.steam_id,
    displayName: user.display_name,
    avatar: user.steam_avatar
  });
});

module.exports = { router, passport };
