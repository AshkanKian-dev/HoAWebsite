require('dotenv').config();
const logger = require('../utils/logger');

// Validate critical environment variables
function validateEnvironment() {
  const isProduction = process.env.NODE_ENV === 'production';
  const warnings = [];
  const errors = [];

  // Check for default/weak secrets in production
  if (isProduction) {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change_this_secret') {
      errors.push('JWT_SECRET must be set to a strong random value in production');
    }
    if (!process.env.ADMIN_API_KEY || process.env.ADMIN_API_KEY === 'change_this_key') {
      errors.push('ADMIN_API_KEY must be set to a strong random value in production');
    }
    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.startsWith('sk_test_')) {
      warnings.push('STRIPE_SECRET_KEY appears to be a test key. Use production key in production.');
    }
    if (!process.env.ALLOWED_ORIGINS) {
      warnings.push('ALLOWED_ORIGINS not set. CORS will use default localhost origins.');
    }
  } else {
    // Development warnings
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change_this_secret') {
      warnings.push('JWT_SECRET is using default value. Change before production deployment.');
    }
    if (!process.env.ADMIN_API_KEY || process.env.ADMIN_API_KEY === 'change_this_key') {
      warnings.push('ADMIN_API_KEY is using default value. Change before production deployment.');
    }
  }

  // Required variables
  if (!process.env.RCON_PASSWORD) {
    warnings.push('RCON_PASSWORD not set. RCON functionality will not work.');
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    warnings.push('STRIPE_SECRET_KEY not set. Stripe payments will not work.');
  }
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    warnings.push('PayPal credentials not set. PayPal payments will not work.');
  }
  if (!process.env.APPLE_PAY_MERCHANT_ID) {
    warnings.push('APPLE_PAY_MERCHANT_ID not set. Apple Pay will not work.');
  }
  if (!process.env.GOOGLE_PAY_MERCHANT_ID) {
    warnings.push('GOOGLE_PAY_MERCHANT_ID not set. Google Pay will not work.');
  }
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    warnings.push('Email credentials not set. Email functionality will not work.');
  }

  // Log warnings
  warnings.forEach(warning => {
    logger.warn(`Environment Warning: ${warning}`);
  });

  // Log errors and exit if critical
  if (errors.length > 0) {
    errors.forEach(error => {
      logger.error(`Environment Error: ${error}`);
    });
    if (isProduction) {
      logger.error('Exiting due to critical environment configuration errors');
      process.exit(1);
    }
  }
}

// Run validation on startup
validateEnvironment();

module.exports = {
  // Server Configuration
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development',
    apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
    gameIp: process.env.GAME_SERVER_IP || 'roejin.com',
    gamePort: parseInt(process.env.GAME_SERVER_PORT || '7775'),
    queryPort: parseInt(process.env.GAME_QUERY_PORT || '27012'),
    maxPlayers: parseInt(process.env.MAX_PLAYERS || '50')
  },

  // Database Configuration
  database: {
    path: process.env.DB_PATH || './database/hoa.db'
  },

  // RCON Configuration
  rcon: {
    host: process.env.RCON_HOST || 'roejin.com',
    port: parseInt(process.env.RCON_PORT || '27029'),
    password: process.env.RCON_PASSWORD || '',
    timeout: parseInt(process.env.RCON_TIMEOUT_MS || '10000')
  },

  // AMP Configuration
  amp: {
    apiUrl: process.env.AMP_API_URL || '',
    username: process.env.AMP_USERNAME || 'heartofacheron',
    password: process.env.AMP_PASSWORD || 'BlueWhale78',
    instanceId: process.env.AMP_INSTANCE_ID || ''
  },

  // Stripe Configuration
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || ''
  },

  // PayPal Configuration
  paypal: {
    clientId: process.env.PAYPAL_CLIENT_ID || '',
    clientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
    mode: process.env.PAYPAL_MODE || 'sandbox',
    webhookSecret: process.env.PAYPAL_WEBHOOK_SECRET || ''
  },

  // Apple Pay Configuration
  applePay: {
    merchantId: process.env.APPLE_PAY_MERCHANT_ID || '',
    domain: process.env.APPLE_PAY_DOMAIN || '',
    displayName: process.env.APPLE_PAY_DISPLAY_NAME || 'Heart of Acheron'
  },

  // Google Pay Configuration
  googlePay: {
    merchantId: process.env.GOOGLE_PAY_MERCHANT_ID || '',
    merchantName: process.env.GOOGLE_PAY_MERCHANT_NAME || 'Heart of Acheron'
  },

  // Email Configuration
  email: {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || '',
    from: process.env.EMAIL_FROM || 'noreply@heartofacheron.com'
  },

  // Security
  security: {
    jwtSecret: process.env.JWT_SECRET || 'change_this_secret',
    adminApiKey: process.env.ADMIN_API_KEY || 'change_this_key'
  },

  // Application Settings
  app: {
    maxRetryAttempts: parseInt(process.env.MAX_RETRY_ATTEMPTS || '3'),
    retryDelayMs: parseInt(process.env.RETRY_DELAY_MS || '5000'),
    deliveryTimeoutMs: parseInt(process.env.DELIVERY_TIMEOUT_MS || '30000')
  }
};

