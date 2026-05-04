const rconService = require('./rcon');
const playerLookup = require('./playerLookup');
const { createDeliveryLog, updatePurchaseStatus, getPurchase } = require('../database/db');
const logger = require('../utils/logger');
const config = require('../config/config');

class DeliveryEngine {
  /**
   * Deliver a product to a player
   * @param {string} orderId - Order ID
   * @param {string} productId - Product ID
   * @param {string} characterName - Character name
   * @param {string} steamId - Steam ID (optional, will lookup if not provided)
   * @param {Array} commands - Array of RCON commands to execute
   * @param {number} retryAttempt - Current retry attempt
   * @returns {Promise<Object>} - Delivery result
   */
  async deliverProduct(orderId, productId, characterName, steamId = null, commands = [], retryAttempt = 0) {
    logger.info(`Starting delivery for order ${orderId} (attempt ${retryAttempt + 1})`);

    try {
      // Validate character name doesn't contain command injection characters
      const dangerousChars = /[;|&$`()<>{}[\]\\"']/;
      if (dangerousChars.test(characterName)) {
        throw new Error(`Invalid character name format: contains dangerous characters`);
      }

      // Get Steam ID if not provided
      if (!steamId) {
        const player = await playerLookup.findPlayer(characterName);
        if (!player) {
          throw new Error(`Player not found: ${characterName}`);
        }
        steamId = player.steamId;
        logger.info(`Resolved Steam ID for ${characterName}: ${steamId}`);
      }

      // Validate Steam ID format (must be exactly 17 digits)
      if (!/^[0-9]{17}$/.test(steamId)) {
        throw new Error(`Invalid Steam ID format: must be exactly 17 digits`);
      }

      // Replace placeholders in commands (values are already validated)
      const processedCommands = commands.map(cmd => 
        cmd.replace(/{STEAM_ID}/g, steamId)
           .replace(/{CHARACTER_NAME}/g, characterName)
      );

      // Execute all commands
      const results = [];
      for (const command of processedCommands) {
        try {
          logger.info(`Executing command: ${command}`);
          const response = await rconService.executeCommand(command, config.app.deliveryTimeoutMs);
          
          results.push({
            command,
            success: true,
            response
          });

          // Log successful command
          await createDeliveryLog({
            order_id: orderId,
            command_executed: command,
            success: true,
            retry_attempt: retryAttempt
          });

        } catch (error) {
          logger.error(`Command failed: ${command}`, error);
          
          results.push({
            command,
            success: false,
            error: error.message
          });

          // Log failed command
          await createDeliveryLog({
            order_id: orderId,
            command_executed: command,
            success: false,
            error_message: error.message,
            retry_attempt: retryAttempt
          });
        }
      }

      // Check if all commands succeeded
      const allSuccess = results.every(r => r.success);
      
      if (allSuccess) {
        // Update order status
        await updatePurchaseStatus(orderId, 'delivered', new Date().toISOString());
        logger.info(`Delivery successful for order ${orderId}`);
        
        return {
          success: true,
          orderId,
          steamId,
          characterName,
          commandsExecuted: results.length,
          results
        };
      } else {
        // Some commands failed
        const failedCommands = results.filter(r => !r.success);
        throw new Error(`Some commands failed: ${failedCommands.map(f => f.command).join(', ')}`);
      }

    } catch (error) {
      logger.error(`Delivery failed for order ${orderId}:`, error);

      // Log failure
      await createDeliveryLog({
        order_id: orderId,
        command_executed: 'DELIVERY_ATTEMPT',
        success: false,
        error_message: error.message,
        retry_attempt: retryAttempt
      });

      // Update status if max retries reached
      if (retryAttempt >= config.app.maxRetryAttempts - 1) {
        await updatePurchaseStatus(orderId, 'failed');
        logger.error(`Max retries reached for order ${orderId}, marking as failed`);
      } else {
        await updatePurchaseStatus(orderId, 'processing');
      }

      throw error;
    }
  }

  /**
   * Retry delivery with exponential backoff
   * @param {string} orderId - Order ID
   * @param {number} retryAttempt - Current retry attempt
   * @returns {Promise<Object>}
   */
  async retryDelivery(orderId, retryAttempt = 0) {
    const purchase = await getPurchase(orderId);
    if (!purchase) {
      throw new Error(`Order not found: ${orderId}`);
    }

    // Get product commands
    const { getProduct } = require('../database/db');
    const product = await getProduct(purchase.product_id);
    if (!product || !product.delivery_commands) {
      throw new Error(`Product not found or has no delivery commands: ${purchase.product_id}`);
    }

    // Calculate delay (exponential backoff)
    const delay = config.app.retryDelayMs * Math.pow(2, retryAttempt);
    logger.info(`Retrying delivery for order ${orderId} in ${delay}ms (attempt ${retryAttempt + 1})`);

    // Wait before retry
    await new Promise(resolve => setTimeout(resolve, delay));

    return this.deliverProduct(
      orderId,
      purchase.product_id,
      purchase.character_name,
      purchase.steam_id,
      product.delivery_commands,
      retryAttempt
    );
  }

  /**
   * Process delivery queue
   * Processes all pending/processing orders
   */
  async processDeliveryQueue() {
    const { getPendingDeliveries } = require('../database/db');
    const pendingOrders = await getPendingDeliveries();

    logger.info(`Processing delivery queue: ${pendingOrders.length} orders`);

    for (const order of pendingOrders) {
      try {
        // Get product
        const { getProduct } = require('../database/db');
        const product = await getProduct(order.product_id);
        
        if (!product) {
          logger.error(`Product not found for order ${order.order_id}`);
          await updatePurchaseStatus(order.order_id, 'failed');
          continue;
        }

        // Get delivery logs to determine retry count
        const { getDeliveryLogs } = require('../database/db');
        const logs = await getDeliveryLogs(order.order_id);
        const retryAttempt = logs.filter(l => !l.success).length;

        // Attempt delivery
        await this.deliverProduct(
          order.order_id,
          order.product_id,
          order.character_name,
          order.steam_id,
          product.delivery_commands,
          retryAttempt
        );

      } catch (error) {
        logger.error(`Error processing order ${order.order_id}:`, error);
        // Will be retried later
      }
    }
  }
}

module.exports = new DeliveryEngine();

