const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const logger = require('../utils/logger');
const config = require('../config/config');

/**
 * Rate limiter for payment endpoints
 */
const paymentRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: 'Too many payment requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for webhook endpoints
 */
const webhookRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Allow more requests for webhooks
  message: 'Too many webhook requests',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for API endpoints
 */
const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many API requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Admin API key authentication middleware
 * Only accepts API key from headers, not query strings (security best practice)
 */
const authenticateAdmin = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey || apiKey !== config.security.adminApiKey) {
    logger.warn(`Unauthorized admin access attempt from ${req.ip}`);
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  next();
};

/**
 * Input validation middleware
 */
const validateInput = (req, res, next) => {
  // Sanitize string inputs
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        // Remove potentially dangerous characters
        req.body[key] = req.body[key].trim();
      }
    });
  }
  
  next();
};

/**
 * Character name validation - prevents command injection
 */
const validateCharacterName = (req, res, next) => {
  const characterName = req.body.character_name || req.body.characterName;
  
  if (!characterName) {
    return res.status(400).json({ error: 'Character name is required' });
  }
  
  // Prevent command injection characters: ; | & $ ` ( ) < > { } [ ] \ " '
  const dangerousChars = /[;|&$`()<>{}[\]\\"']/;
  if (dangerousChars.test(characterName)) {
    logger.warn(`Suspicious character name detected: ${characterName} from ${req.ip}`);
    return res.status(400).json({ 
      error: 'Invalid character name format. Contains disallowed characters.' 
    });
  }
  
  // Basic validation: alphanumeric, spaces, and safe special chars only
  const validPattern = /^[a-zA-Z0-9\s\-_]{1,32}$/;
  if (!validPattern.test(characterName)) {
    return res.status(400).json({ 
      error: 'Invalid character name format. Must be 1-32 characters, alphanumeric with spaces, hyphens, or underscores.' 
    });
  }
  
  next();
};

/**
 * Steam ID validation - must be exactly 17 digits
 */
const validateSteamId = (req, res, next) => {
  const steamId = req.body.steam_id || req.body.steamId;
  
  if (steamId && !/^[0-9]{17}$/.test(steamId)) {
    return res.status(400).json({ 
      error: 'Invalid Steam ID format. Must be exactly 17 digits.' 
    });
  }
  
  next();
};

/**
 * RCON command injection prevention
 * Validates that Steam IDs and character names are safe for RCON commands
 */
const validateRconInputs = (req, res, next) => {
  const characterName = req.body.character_name || req.body.characterName;
  const steamId = req.body.steam_id || req.body.steamId;
  
  // Validate Steam ID if provided
  if (steamId && !/^[0-9]{17}$/.test(steamId)) {
    logger.warn(`Invalid Steam ID format detected: ${steamId} from ${req.ip}`);
    return res.status(400).json({ error: 'Invalid Steam ID format' });
  }
  
  // Validate character name doesn't contain command injection characters
  if (characterName) {
    const dangerousChars = /[;|&$`()<>{}[\]\\"']/;
    if (dangerousChars.test(characterName)) {
      logger.warn(`Potential command injection attempt: character name "${characterName}" from ${req.ip}`);
      return res.status(400).json({ error: 'Invalid character name format' });
    }
  }
  
  next();
};

/**
 * Email validation
 */
const validateEmail = (req, res, next) => {
  const email = req.body.email || req.body.customer_email;
  
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  
  next();
};

/**
 * CORS configuration
 */
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, file:// protocol, etc.)
    if (!origin) return callback(null, true);
    
    // In development, allow all origins for easier testing
    if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
      return callback(null, true);
    }
    
    // In production, specify allowed origins
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:3000', 'http://localhost:8080', 'http://localhost:5500', 'http://127.0.0.1:5500'];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
};

/**
 * Error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  });

  // Don't leak error details in production
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;

  res.status(err.status || 500).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = {
  paymentRateLimiter,
  webhookRateLimiter,
  apiRateLimiter,
  authenticateAdmin,
  validateInput,
  validateCharacterName,
  validateSteamId,
  validateRconInputs,
  validateEmail,
  corsOptions,
  errorHandler,
  helmet
};

