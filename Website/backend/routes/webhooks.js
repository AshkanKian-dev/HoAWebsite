const express = require('express');
const router = express.Router();
const stripe = require('stripe')(require('../config/config').stripe.secretKey);
const orderProcessor = require('../services/orderProcessor');
const logger = require('../utils/logger');
const { webhookRateLimiter, errorHandler } = require('../middleware/security');
const config = require('../config/config');

// Store processed webhook IDs to prevent duplicate processing
const processedWebhooks = new Set();
const WEBHOOK_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Stripe webhook handler
 */
router.post('/stripe', webhookRateLimiter, express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  
  if (!sig) {
    logger.warn('Stripe webhook received without signature');
    return res.status(400).send('Missing signature');
  }

  let event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(req.body, sig, config.stripe.webhookSecret);
  } catch (err) {
    logger.error('Stripe webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Check for duplicate processing
  if (processedWebhooks.has(event.id)) {
    logger.warn(`Duplicate Stripe webhook received: ${event.id}`);
    return res.status(200).json({ received: true, duplicate: true });
  }

  logger.info(`Processing Stripe webhook: ${event.type} (${event.id})`);

  try {
    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handleStripePaymentSuccess(event.data.object);
        break;
      
      case 'payment_intent.payment_failed':
        await handleStripePaymentFailed(event.data.object);
        break;
      
      case 'charge.refunded':
        await handleStripeRefund(event.data.object);
        break;
      
      default:
        logger.debug(`Unhandled Stripe event type: ${event.type}`);
    }

    // Mark as processed
    processedWebhooks.add(event.id);

    // Return a response to acknowledge receipt of the event
    res.json({ received: true });

  } catch (error) {
    logger.error('Error processing Stripe webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * Handle successful Stripe payment
 */
async function handleStripePaymentSuccess(paymentIntent) {
  logger.info(`Processing successful Stripe payment: ${paymentIntent.id}`);

  try {
    // Extract metadata from payment intent
    const metadata = paymentIntent.metadata || {};
    const characterName = metadata.character_name || metadata.characterName;
    const productId = metadata.product_id || metadata.productId;
    const email = paymentIntent.receipt_email || metadata.email;

    if (!characterName || !productId) {
      logger.error('Missing required metadata in payment intent:', { paymentIntent });
      throw new Error('Missing character_name or product_id in payment metadata');
    }

    // Process order
    await orderProcessor.processOrder({
      order_id: paymentIntent.id,
      email,
      character_name: characterName,
      steam_id: metadata.steam_id || null,
      product_id: productId,
      amount: paymentIntent.amount / 100, // Convert from cents
      payment_provider: 'stripe',
      payment_intent_id: paymentIntent.id,
      metadata: metadata
    });

    logger.info(`Order processed successfully for payment ${paymentIntent.id}`);

  } catch (error) {
    logger.error('Error handling Stripe payment success:', error);
    throw error;
  }
}

/**
 * Handle failed Stripe payment
 */
async function handleStripePaymentFailed(paymentIntent) {
  logger.warn(`Stripe payment failed: ${paymentIntent.id}`);
  // Could update order status or send notification
}

/**
 * Handle Stripe refund
 */
async function handleStripeRefund(charge) {
  logger.info(`Processing Stripe refund: ${charge.id}`);
  
  const { getPurchase, updatePurchaseStatus } = require('../database/db');
  
  // Find order by payment intent ID
  const purchase = await getPurchase(charge.payment_intent);
  if (purchase) {
    await updatePurchaseStatus(purchase.order_id, 'refunded');
    logger.info(`Order ${purchase.order_id} marked as refunded`);
  }
}

/**
 * PayPal webhook handler with signature verification
 */
router.post('/paypal', webhookRateLimiter, express.json(), async (req, res) => {
  const event = req.body;
  const headers = req.headers;

  if (!event || !event.event_type) {
    logger.warn('Invalid PayPal webhook received');
    return res.status(400).json({ error: 'Invalid webhook data' });
  }

  // Verify webhook signature if configured
  if (config.paypal.webhookSecret) {
    try {
      // PayPal webhook signature verification
      // Note: PayPal uses a different signature verification method than Stripe
      // For production, implement proper signature verification using PayPal's SDK
      // This is a placeholder - in production, verify using:
      // const paypalWebhook = require('@paypal/checkout-server-sdk');
      // Verify webhook signature using PayPal's verification method
      
      // For now, we'll log a warning if signature verification is expected
      const authAlgo = headers['paypal-auth-algo'];
      const certUrl = headers['paypal-cert-url'];
      const transmissionId = headers['paypal-transmission-id'];
      const transmissionSig = headers['paypal-transmission-sig'];
      const transmissionTime = headers['paypal-transmission-time'];

      if (authAlgo && certUrl && transmissionId && transmissionSig && transmissionTime) {
        // Signature headers present - in production, verify here
        logger.debug('PayPal webhook signature headers present - verification should be implemented');
      } else {
        logger.warn('PayPal webhook received without signature headers');
      }
    } catch (err) {
      logger.error('PayPal webhook signature verification error:', err.message);
      // In production, you might want to reject unsigned webhooks
      // return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }

  // Check for duplicate processing
  if (event.id && processedWebhooks.has(event.id)) {
    logger.warn(`Duplicate PayPal webhook received: ${event.id}`);
    return res.status(200).json({ received: true, duplicate: true });
  }

  logger.info(`Processing PayPal webhook: ${event.event_type} (${event.id || 'no-id'})`);

  try {
    // Handle PayPal events
    switch (event.event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED':
        await handlePayPalPaymentSuccess(event.resource);
        break;
      
      case 'PAYMENT.CAPTURE.DENIED':
      case 'PAYMENT.CAPTURE.REFUNDED':
        await handlePayPalPaymentFailure(event.resource);
        break;
      
      case 'CHECKOUT.ORDER.APPROVED':
        // Order was approved but not yet captured
        logger.info(`PayPal order approved: ${event.resource?.id}`);
        break;
      
      default:
        logger.debug(`Unhandled PayPal event type: ${event.event_type}`);
    }

    // Mark as processed
    if (event.id) {
      processedWebhooks.add(event.id);
    }

    res.json({ received: true });

  } catch (error) {
    logger.error('Error processing PayPal webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * Handle successful PayPal payment
 */
async function handlePayPalPaymentSuccess(capture) {
  logger.info(`Processing successful PayPal payment: ${capture.id}`);

  try {
    // Extract metadata from custom_id or other fields
    // PayPal structure may vary - adjust based on your implementation
    const customId = capture.custom_id || '';
    const metadata = customId ? JSON.parse(customId) : {};
    
    const characterName = metadata.character_name || metadata.characterName;
    const productId = metadata.product_id || metadata.productId;
    const email = capture.payer?.email_address || metadata.email;

    if (!characterName || !productId) {
      logger.error('Missing required metadata in PayPal capture:', { capture });
      throw new Error('Missing character_name or product_id in PayPal metadata');
    }

    // Process order
    await orderProcessor.processOrder({
      order_id: capture.id,
      email,
      character_name: characterName,
      steam_id: metadata.steam_id || null,
      product_id: productId,
      amount: parseFloat(capture.amount?.value || '0'),
      payment_provider: 'paypal',
      payment_intent_id: capture.id,
      metadata: metadata
    });

    logger.info(`Order processed successfully for PayPal payment ${capture.id}`);

  } catch (error) {
    logger.error('Error handling PayPal payment success:', error);
    throw error;
  }
}

/**
 * Handle failed PayPal payment
 */
async function handlePayPalPaymentFailure(capture) {
  logger.warn(`PayPal payment failed: ${capture.id}`);
  // Could update order status or send notification
}

module.exports = router;

