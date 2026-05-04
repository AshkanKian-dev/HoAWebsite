const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const csrf = require('csurf');
const session = require('express-session');
const config = require('./config/config');
const logger = require('./utils/logger');
const { corsOptions, errorHandler } = require('./middleware/security');
const { cleanupOldAttempts } = require('./database/db');

// Import routes
const webhooksRouter = require('./routes/webhooks');
const ordersRouter = require('./routes/orders');
const adminRouter = require('./routes/admin');
const paymentIntentRouter = require('./routes/payment-intent');
const authRouter = require('./routes/auth');
const contactRouter = require('./routes/contact');
const { router: steamAuthRouter, passport } = require('./routes/steam-auth');

// Import services
const deliveryEngine = require('./services/deliveryEngine');

const app = express();

// Enhanced security headers with Helmet
const isDevelopment = process.env.NODE_ENV !== 'production';
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://js.stripe.com", "https://www.paypal.com"],
      imgSrc: ["'self'", "data:", "https:", "https://avatars.steamstatic.com", "https://steamcdn-a.akamaihd.net"],
      connectSrc: isDevelopment
        ? ["'self'", "http://localhost:3000", "http://127.0.0.1:3000", "https://api.stripe.com", "https://api.sandbox.paypal.com", "https://api.paypal.com", "https://steamcommunity.com"]
        : ["'self'", "https://api.stripe.com", "https://api.sandbox.paypal.com", "https://api.paypal.com", "https://steamcommunity.com"],
      frameSrc: ["'self'", "https://js.stripe.com", "https://www.sandbox.paypal.com", "https://www.paypal.com"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  permissionsPolicy: {
    features: {
      geolocation: ["'none'"],
      microphone: ["'none'"],
      camera: ["'none'"]
    }
  }
}));

// CORS configuration
app.use(cors(corsOptions));

// Cookie parser (needed for CSRF and session cookies)
app.use(cookieParser());

// express-session (required by passport-steam for the OAuth round-trip)
app.use(session({
  secret: process.env.SESSION_SECRET || 'change_this_in_production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',   // 'lax' allows the Steam redirect to carry the cookie
    maxAge: 10 * 60 * 1000  // 10 minutes — only needed for the OAuth round-trip
  }
}));

// Passport initialization (Steam OpenID)
app.use(passport.initialize());
app.use(passport.session());

// Body parser with size limits to prevent DoS attacks
app.use(bodyParser.json({ limit: '1mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '1mb' }));

// CSRF protection (exclude webhooks and Steam auth callbacks)
const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  }
});

app.use((req, res, next) => {
  if (req.path.startsWith('/api/webhooks') || req.path.startsWith('/api/auth/steam')) {
    return next();
  }
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  csrfProtection(req, res, next);
});

// CSRF error handler
app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    logger.warn(`CSRF token validation failed from ${req.ip}`);
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  next(err);
});

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, { ip: req.ip });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.server.env
  });
});

// CSRF token endpoint (for frontend to get token)
app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// Public config endpoint — only exposes publishable/client-side keys, never secrets
app.get('/api/config', (req, res) => {
  res.json({
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    paypalClientId: process.env.PAYPAL_CLIENT_ID || '',
    paypalMode: process.env.PAYPAL_MODE || 'sandbox',
    googlePayMerchantId: process.env.GOOGLE_PAY_MERCHANT_ID || '',
    applePay: {
      merchantId: process.env.APPLE_PAY_MERCHANT_ID || '',
      displayName: process.env.APPLE_PAY_DISPLAY_NAME || 'Heart of Acheron'
    }
  });
});

// API routes
app.use('/api/webhooks', webhooksRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/admin', adminRouter);
app.use('/api/auth', authRouter);
app.use('/api/auth', steamAuthRouter);   // Steam OpenID: /api/auth/steam, /api/auth/steam/callback
app.use('/api/forum', require('./routes/forum'));
app.use('/api/server', require('./routes/server'));
app.use('/api', paymentIntentRouter);
app.use('/api', contactRouter);

// Error handler (must be last)
app.use(errorHandler);

// Process delivery queue every 5 minutes
setInterval(async () => {
  try {
    logger.info('Processing delivery queue...');
    await deliveryEngine.processDeliveryQueue();
  } catch (error) {
    logger.error('Error processing delivery queue:', error);
  }
}, 5 * 60 * 1000);

// Cleanup old login attempts every hour
setInterval(async () => {
  try {
    const result = cleanupOldAttempts();
    if (result.changes > 0) {
      logger.info(`Cleaned up ${result.changes} old login attempts`);
    }
  } catch (error) {
    logger.error('Error cleaning up login attempts:', error);
  }
}, 60 * 60 * 1000);

// Start server
const PORT = config.server.port;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${config.server.env}`);
  logger.info(`API Base URL: ${config.server.apiBaseUrl}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

module.exports = app;
