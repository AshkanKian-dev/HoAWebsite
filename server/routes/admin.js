const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const { db, getPurchase, getPendingDeliveries, getDeliveryLogs, updatePurchaseStatus, 
        getContactSubmissions, getContactSubmission, updateContactSubmissionStatus,
        getAllUsers, getUserById, banUser, unbanUser } = require('../database/db');
const deliveryEngine = require('../services/deliveryEngine');
const orderProcessor = require('../services/orderProcessor');
const logger = require('../utils/logger');

// All admin routes require authentication and admin privileges
router.use(authenticate);
router.use(requireAdmin);

/**
 * Get statistics
 */
router.get('/stats', (req, res) => {
  try {
    const stats = {
      totalOrders: db.prepare('SELECT COUNT(*) as count FROM purchases').get().count,
      pendingOrders: db.prepare("SELECT COUNT(*) as count FROM purchases WHERE status IN ('pending', 'processing')").get().count,
      deliveredOrders: db.prepare("SELECT COUNT(*) as count FROM purchases WHERE status = 'delivered'").get().count,
      failedOrders: db.prepare("SELECT COUNT(*) as count FROM purchases WHERE status = 'failed'").get().count,
      totalRevenue: db.prepare('SELECT SUM(price) as total FROM purchases WHERE status = "delivered"').get().total || 0
    };
    
    res.json(stats);
  } catch (error) {
    logger.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

/**
 * Get all orders with pagination
 */
router.get('/orders', (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '50');
    const offset = parseInt(req.query.offset || '0');
    
    const orders = db.prepare(`
      SELECT * FROM purchases 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `).all(limit, offset);
    
    const total = db.prepare('SELECT COUNT(*) as count FROM purchases').get().count;
    
    res.json({
      orders: orders.map(o => {
        if (o.metadata) o.metadata = JSON.parse(o.metadata);
        return o;
      }),
      total,
      limit,
      offset
    });
  } catch (error) {
    logger.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

/**
 * Get order details
 */
router.get('/orders/:orderId', (req, res) => {
  try {
    const order = getPurchase(req.params.orderId);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Get delivery logs
    const logs = getDeliveryLogs(req.params.orderId);
    
    res.json({
      order,
      deliveryLogs: logs
    });
  } catch (error) {
    logger.error('Error fetching order details:', error);
    res.status(500).json({ error: 'Failed to fetch order details' });
  }
});

/**
 * Retry failed order
 */
router.post('/orders/:orderId/retry', async (req, res) => {
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
    res.status(500).json({ error: error.message || 'Failed to retry order' });
  }
});

/**
 * Get pending deliveries
 */
router.get('/deliveries/pending', (req, res) => {
  try {
    const pending = getPendingDeliveries();
    res.json({
      pending,
      count: pending.length
    });
  } catch (error) {
    logger.error('Error fetching pending deliveries:', error);
    res.status(500).json({ error: 'Failed to fetch pending deliveries' });
  }
});

/**
 * Process delivery queue manually
 */
router.post('/deliveries/process', async (req, res) => {
  try {
    await deliveryEngine.processDeliveryQueue();
    res.json({
      success: true,
      message: 'Delivery queue processed'
    });
  } catch (error) {
    logger.error('Error processing delivery queue:', error);
    res.status(500).json({ error: 'Failed to process delivery queue' });
  }
});

/**
 * Get all contact form submissions
 */
router.get('/contact-submissions', (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '50');
    const offset = parseInt(req.query.offset || '0');
    const status = req.query.status || null;
    
    const submissions = getContactSubmissions(limit, offset, status);
    const totalStmt = status 
      ? db.prepare('SELECT COUNT(*) as count FROM contact_submissions WHERE status = ?')
      : db.prepare('SELECT COUNT(*) as count FROM contact_submissions');
    const total = status ? totalStmt.get(status) : totalStmt.get();
    
    res.json({
      submissions,
      total: total.count,
      limit,
      offset
    });
  } catch (error) {
    logger.error('Error fetching contact submissions:', error);
    res.status(500).json({ error: 'Failed to fetch contact submissions' });
  }
});

/**
 * Get single contact submission
 */
router.get('/contact-submissions/:id', (req, res) => {
  try {
    const submission = getContactSubmission(req.params.id);
    
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    
    res.json(submission);
  } catch (error) {
    logger.error('Error fetching contact submission:', error);
    res.status(500).json({ error: 'Failed to fetch contact submission' });
  }
});

/**
 * Update contact submission status
 */
router.put('/contact-submissions/:id', (req, res) => {
  try {
    const { status } = req.body;
    const submissionId = req.params.id;
    
    if (!status || !['new', 'read', 'replied', 'archived'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const readAt = status === 'read' || status === 'replied' ? new Date().toISOString() : null;
    const repliedAt = status === 'replied' ? new Date().toISOString() : null;
    
    updateContactSubmissionStatus(submissionId, status, readAt, repliedAt);
    
    const submission = getContactSubmission(submissionId);
    res.json(submission);
  } catch (error) {
    logger.error('Error updating contact submission:', error);
    res.status(500).json({ error: 'Failed to update contact submission' });
  }
});

/**
 * Get all users with pagination
 */
router.get('/users', (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '50');
    const offset = parseInt(req.query.offset || '0');
    
    const users = getAllUsers(limit, offset);
    const total = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    
    res.json({
      users,
      total: total.count,
      limit,
      offset
    });
  } catch (error) {
    logger.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * Get user details
 */
router.get('/users/:userId', (req, res) => {
  try {
    const user = getUserById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    logger.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

/**
 * Ban a user
 */
router.post('/users/:userId/ban', (req, res) => {
  try {
    const { reason } = req.body;
    const userId = req.params.userId;
    
    // Don't allow banning yourself
    if (userId === req.user.userId) {
      return res.status(400).json({ error: 'Cannot ban yourself' });
    }
    
    banUser(userId, reason || null);
    
    logger.info(`User ${userId} banned by admin ${req.user.userId}. Reason: ${reason || 'No reason provided'}`);
    
    const user = getUserById(userId);
    res.json({
      success: true,
      message: 'User banned successfully',
      user
    });
  } catch (error) {
    logger.error('Error banning user:', error);
    res.status(500).json({ error: 'Failed to ban user' });
  }
});

/**
 * Unban a user
 */
router.post('/users/:userId/unban', (req, res) => {
  try {
    const userId = req.params.userId;
    
    unbanUser(userId);
    
    logger.info(`User ${userId} unbanned by admin ${req.user.userId}`);
    
    const user = getUserById(userId);
    res.json({
      success: true,
      message: 'User unbanned successfully',
      user
    });
  } catch (error) {
    logger.error('Error unbanning user:', error);
    res.status(500).json({ error: 'Failed to unban user' });
  }
});

module.exports = router;

