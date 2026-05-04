const express = require('express');
const router = require('express').Router();
const config = require('../config/config');
const stripe = require('stripe')(config.stripe.secretKey);
const paypal = require('@paypal/checkout-server-sdk');
const { getProduct } = require('../database/db');
const { apiRateLimiter, validateInput, validateCharacterName, validateEmail, validateRconInputs } = require('../middleware/security');
const logger = require('../utils/logger');

// Initialize PayPal environment
function paypalEnvironment() {
  const clientId = config.paypal.clientId;
  const clientSecret = config.paypal.clientSecret;
  const mode = config.paypal.mode || 'sandbox';

  if (mode === 'production') {
    return new paypal.core.LiveEnvironment(clientId, clientSecret);
  } else {
    return new paypal.core.SandboxEnvironment(clientId, clientSecret);
  }
}

function paypalClient() {
  return new paypal.core.PayPalHttpClient(paypalEnvironment());
}

/**
 * Create Stripe payment intent
 */
router.post('/create-payment-intent', 
  apiRateLimiter, 
  validateInput, 
  validateCharacterName, 
  validateEmail,
  validateRconInputs,
  async (req, res, next) => {
    try {
      const { amount, currency = 'usd', product_id, metadata } = req.body;

      if (!amount || !product_id) {
        return res.status(400).json({ error: 'Amount and product_id are required' });
      }

      // Verify product exists
      const product = await getProduct(product_id);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      // Create payment intent with metadata
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount), // Amount in cents
        currency,
        metadata: {
          product_id,
          product_name: product.name,
          character_name: metadata.character_name || req.body.metadata?.character_name,
          steam_id: metadata.steam_id || req.body.metadata?.steam_id || '',
          email: metadata.email || req.body.metadata?.email || req.body.email
        },
        automatic_payment_methods: {
          enabled: true
        }
      });

      logger.info(`Created payment intent: ${paymentIntent.id} for product ${product_id}`);

      res.json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id
      });

    } catch (error) {
      logger.error('Error creating payment intent:', error);
      next(error);
    }
  }
);

/**
 * Create PayPal order
 */
router.post('/create-paypal-order',
  apiRateLimiter,
  validateInput,
  validateCharacterName,
  validateEmail,
  async (req, res, next) => {
    try {
      const { amount, currency = 'USD', product_id, metadata } = req.body;

      if (!amount || !product_id) {
        return res.status(400).json({ error: 'Amount and product_id are required' });
      }

      // Verify product exists
      const product = await getProduct(product_id);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      // Check PayPal configuration
      if (!config.paypal.clientId || !config.paypal.clientSecret) {
        logger.warn('PayPal credentials not configured');
        return res.status(500).json({ error: 'PayPal payment is not configured' });
      }

      const request = new paypal.orders.OrdersCreateRequest();
      request.prefer('return=representation');
      request.requestBody({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: currency,
            value: parseFloat(amount).toFixed(2)
          },
          description: product.name,
          custom_id: JSON.stringify({
            product_id,
            product_name: product.name,
            character_name: metadata?.character_name || req.body.metadata?.character_name || '',
            steam_id: metadata?.steam_id || req.body.metadata?.steam_id || '',
            email: metadata?.email || req.body.metadata?.email || req.body.email || ''
          })
        }],
        application_context: {
          brand_name: 'Heart of Acheron',
          landing_page: 'BILLING',
          user_action: 'PAY_NOW',
          return_url: `${config.server.apiBaseUrl}/payment-success`,
          cancel_url: `${config.server.apiBaseUrl}/payment-cancel`
        }
      });

      const client = paypalClient();
      const order = await client.execute(request);

      logger.info(`Created PayPal order: ${order.result.id} for product ${product_id}`);

      res.json({
        orderId: order.result.id,
        status: order.result.status
      });

    } catch (error) {
      logger.error('Error creating PayPal order:', error);
      next(error);
    }
  }
);

/**
 * Capture PayPal order
 */
router.post('/capture-paypal-order',
  apiRateLimiter,
  validateInput,
  async (req, res, next) => {
    try {
      const { orderId } = req.body;

      if (!orderId) {
        return res.status(400).json({ error: 'Order ID is required' });
      }

      if (!config.paypal.clientId || !config.paypal.clientSecret) {
        return res.status(500).json({ error: 'PayPal payment is not configured' });
      }

      const request = new paypal.orders.OrdersCaptureRequest(orderId);
      request.requestBody({});

      const client = paypalClient();
      const capture = await client.execute(request);

      logger.info(`Captured PayPal order: ${orderId}`);

      res.json({
        orderId: capture.result.id,
        status: capture.result.status,
        captureId: capture.result.purchase_units[0]?.payments?.captures[0]?.id
      });

    } catch (error) {
      logger.error('Error capturing PayPal order:', error);
      next(error);
    }
  }
);

/**
 * Apple Pay merchant validation
 */
router.post('/apple-pay/validate-merchant',
  apiRateLimiter,
  async (req, res, next) => {
    try {
      const { validationURL } = req.body;

      if (!validationURL) {
        return res.status(400).json({ error: 'Validation URL is required' });
      }

      if (!config.applePay?.merchantId) {
        logger.warn('Apple Pay merchant ID not configured');
        return res.status(500).json({ error: 'Apple Pay is not configured' });
      }

      // Apple Pay merchant validation requires a certificate-based approach
      // For production, you need to set up proper merchant validation
      // This is a simplified version - in production, use proper certificate validation
      
      // In production, you would:
      // 1. Create a merchant session using Apple's validation service
      // 2. Use your merchant certificate to sign the request
      // 3. Return the merchant session to the client

      // For now, we'll return an error indicating configuration is needed
      // The frontend will handle this gracefully
      logger.warn('Apple Pay merchant validation requires additional setup');
      return res.status(501).json({ 
        error: 'Apple Pay merchant validation requires certificate setup',
        message: 'Please configure Apple Pay merchant certificate for production use'
      });

    } catch (error) {
      logger.error('Error validating Apple Pay merchant:', error);
      next(error);
    }
  }
);

/**
 * Process Google Pay payment
 * Google Pay uses Stripe as the payment gateway
 */
router.post('/google-pay/process-payment',
  apiRateLimiter,
  validateInput,
  validateCharacterName,
  validateEmail,
  async (req, res, next) => {
    try {
      const { paymentData, amount, currency = 'usd', product_id, metadata } = req.body;

      if (!paymentData || !amount || !product_id) {
        return res.status(400).json({ error: 'Payment data, amount, and product_id are required' });
      }

      // Verify product exists
      const product = await getProduct(product_id);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      if (!config.stripe.secretKey) {
        return res.status(500).json({ error: 'Stripe is not configured' });
      }

      // Google Pay provides a payment token that needs to be processed through Stripe
      // The paymentData contains the token from Google Pay
      const paymentMethod = paymentData.paymentMethodData?.tokenizationData?.token;

      if (!paymentMethod) {
        return res.status(400).json({ error: 'Invalid payment data from Google Pay' });
      }

      // Create payment intent with Google Pay token
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(parseFloat(amount) * 100), // Convert to cents
        currency,
        payment_method_data: {
          type: 'card',
          card: {
            token: paymentMethod
          }
        },
        metadata: {
          product_id,
          product_name: product.name,
          character_name: metadata?.character_name || req.body.metadata?.character_name || '',
          steam_id: metadata?.steam_id || req.body.metadata?.steam_id || '',
          email: metadata?.email || req.body.metadata?.email || req.body.email || '',
          payment_method: 'google_pay'
        },
        confirm: true,
        return_url: `${config.server.apiBaseUrl}/payment-success`
      });

      logger.info(`Created Google Pay payment intent: ${paymentIntent.id} for product ${product_id}`);

      res.json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status
      });

    } catch (error) {
      logger.error('Error processing Google Pay payment:', error);
      next(error);
    }
  }
);

module.exports = router;

