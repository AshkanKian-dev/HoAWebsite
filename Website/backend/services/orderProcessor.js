const { v4: uuidv4 } = require('uuid');
const { createPurchase, getProduct, updatePurchaseStatus } = require('../database/db');
const deliveryEngine = require('./deliveryEngine');
const playerLookup = require('./playerLookup');
const logger = require('../utils/logger');

class OrderProcessor {
  /**
   * Process a new order
   * @param {Object} orderData - Order data from payment webhook
   * @returns {Promise<Object>} - Processed order
   */
  async processOrder(orderData) {
    logger.info(`Processing new order: ${orderData.product_id} for ${orderData.character_name}`);

    // Validate product exists
    const product = await getProduct(orderData.product_id);
    if (!product) {
      throw new Error(`Product not found: ${orderData.product_id}`);
    }

    // Generate order ID if not provided
    const orderId = orderData.order_id || uuidv4();

    // Try to resolve Steam ID
    let steamId = orderData.steam_id || null;
    if (!steamId && orderData.character_name) {
      const player = await playerLookup.findPlayer(orderData.character_name);
      if (player) {
        steamId = player.steamId;
      }
    }

    // Create purchase record
    const purchaseData = {
      order_id: orderId,
      customer_email: orderData.email,
      steam_id: steamId,
      character_name: orderData.character_name,
      product_id: product.product_id,
      product_name: product.name,
      price: orderData.amount || product.price,
      payment_provider: orderData.payment_provider,
      payment_intent_id: orderData.payment_intent_id,
      status: 'pending',
      metadata: orderData.metadata || {}
    };

    await createPurchase(purchaseData);
    logger.info(`Order created: ${orderId}`);

    // Update order status to processing
    await updatePurchaseStatus(orderId, 'processing');

    // Attempt immediate delivery
    try {
      if (product.delivery_commands && product.delivery_commands.length > 0) {
        await deliveryEngine.deliverProduct(
          orderId,
          product.product_id,
          orderData.character_name,
          steamId,
          product.delivery_commands,
          0
        );
        logger.info(`Order ${orderId} delivered successfully`);
      } else {
        // No delivery commands (e.g., donation packages)
        await updatePurchaseStatus(orderId, 'delivered');
        logger.info(`Order ${orderId} marked as delivered (no commands)`);
      }
    } catch (error) {
      logger.error(`Failed to deliver order ${orderId}:`, error);
      // Order remains in 'processing' status for retry
    }

    return {
      orderId,
      status: 'processing',
      steamId,
      product: product.name
    };
  }

  /**
   * Retry failed order
   * @param {string} orderId - Order ID
   * @returns {Promise<Object>}
   */
  async retryOrder(orderId) {
    logger.info(`Retrying order: ${orderId}`);
    
    const { getPurchase } = require('../database/db');
    const purchase = await getPurchase(orderId);
    
    if (!purchase) {
      throw new Error(`Order not found: ${orderId}`);
    }

    if (purchase.status === 'delivered') {
      throw new Error(`Order already delivered: ${orderId}`);
    }

    // Get retry attempt count
    const { getDeliveryLogs } = require('../database/db');
    const logs = await getDeliveryLogs(orderId);
    const retryAttempt = logs.filter(l => !l.success).length;

    await updatePurchaseStatus(orderId, 'processing');
    
    return deliveryEngine.retryDelivery(orderId, retryAttempt);
  }
}

module.exports = new OrderProcessor();

