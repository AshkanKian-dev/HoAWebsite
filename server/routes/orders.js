const express = require('express');
const router = express.Router();
const { getPurchase, getPurchasesByEmail, getPendingDeliveries } = require('../database/db');
const orderProcessor = require('../services/orderProcessor');
const { apiRateLimiter, authenticateAdmin, validateEmail } = require('../middleware/security');
const logger = require('../utils/logger');

/**
 * Get order by ID
 */
router.get('/:orderId', apiRateLimiter, async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const order = await getPurchase(orderId);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json(order);
  } catch (error) {
    next(error);
  }
});

/**
 * Get orders by email
 */
router.get('/email/:email', apiRateLimiter, validateEmail, async (req, res, next) => {
  try {
    const { email } = req.params;
    const orders = await getPurchasesByEmail(email);
    
    res.json({ orders, count: orders.length });
  } catch (error) {
    next(error);
  }
});

/**
 * Retry failed order (admin only)
 */
router.post('/:orderId/retry', apiRateLimiter, authenticateAdmin, async (req, res, next) => {
  try {
    const { orderId } = req.params;
    
    const result = await orderProcessor.retryOrder(orderId);
    
    res.json({
      success: true,
      message: 'Order retry initiated',
      order: result
    });
  } catch (error) {
    logger.error(`Error retrying order ${req.params.orderId}:`, error);
    next(error);
  }
});

/**
 * Get pending deliveries (admin only)
 */
router.get('/admin/pending', apiRateLimiter, authenticateAdmin, async (req, res, next) => {
  try {
    const pending = await getPendingDeliveries();
    
    res.json({
      pending,
      count: pending.length
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

