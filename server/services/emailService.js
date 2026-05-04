const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
const config = require('../config/config');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initialized = false;
    this.init();
  }

  /**
   * Initialize email transporter
   */
  init() {
    if (!config.email.user || !config.email.pass) {
      logger.warn('Email configuration not set, email service disabled');
      this.initialized = false;
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: config.email.host,
        port: config.email.port,
        secure: config.email.port === 465,
        auth: {
          user: config.email.user,
          pass: config.email.pass
        }
      });

      this.initialized = true;
      logger.info('Email service initialized');
    } catch (error) {
      logger.error('Failed to initialize email service:', error);
      this.initialized = false;
    }
  }

  /**
   * Send email
   * @param {Object} options - Email options
   */
  async sendEmail(options) {
    if (!this.initialized) {
      logger.warn('Email service not initialized, skipping email send');
      return false;
    }

    try {
      const mailOptions = {
        from: config.email.from,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html || options.text
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent successfully to ${options.to}: ${info.messageId}`);
      return true;
    } catch (error) {
      logger.error('Error sending email:', error);
      return false;
    }
  }

  /**
   * Send order confirmation email
   */
  async sendOrderConfirmation(order) {
    const html = `
      <h2>Order Confirmation</h2>
      <p>Thank you for your purchase!</p>
      <p><strong>Order ID:</strong> ${order.order_id}</p>
      <p><strong>Product:</strong> ${order.product_name}</p>
      <p><strong>Amount:</strong> $${order.price.toFixed(2)}</p>
      <p><strong>Character:</strong> ${order.character_name}</p>
      <p><strong>Status:</strong> ${order.status}</p>
      <p>Your items will be delivered to your in-game character shortly.</p>
    `;

    return this.sendEmail({
      to: order.customer_email,
      subject: `Order Confirmation - ${order.order_id}`,
      html,
      text: `Order Confirmation\n\nOrder ID: ${order.order_id}\nProduct: ${order.product_name}\nAmount: $${order.price.toFixed(2)}\nCharacter: ${order.character_name}\nStatus: ${order.status}`
    });
  }

  /**
   * Send delivery success notification
   */
  async sendDeliverySuccess(order) {
    const html = `
      <h2>Delivery Successful</h2>
      <p>Your order has been successfully delivered!</p>
      <p><strong>Order ID:</strong> ${order.order_id}</p>
      <p><strong>Product:</strong> ${order.product_name}</p>
      <p><strong>Character:</strong> ${order.character_name}</p>
      <p>Please check your in-game inventory to confirm receipt.</p>
    `;

    return this.sendEmail({
      to: order.customer_email,
      subject: `Delivery Successful - ${order.order_id}`,
      html,
      text: `Delivery Successful\n\nOrder ID: ${order.order_id}\nProduct: ${order.product_name}\nCharacter: ${order.character_name}\nYour items have been delivered to your in-game character.`
    });
  }

  /**
   * Send delivery failure alert to admin
   */
  async sendDeliveryFailureAlert(order, error) {
    const html = `
      <h2>Delivery Failure Alert</h2>
      <p>An order delivery has failed and requires manual intervention.</p>
      <p><strong>Order ID:</strong> ${order.order_id}</p>
      <p><strong>Product:</strong> ${order.product_name}</p>
      <p><strong>Character:</strong> ${order.character_name}</p>
      <p><strong>Steam ID:</strong> ${order.steam_id || 'Not found'}</p>
      <p><strong>Error:</strong> ${error.message || 'Unknown error'}</p>
      <p>Please review and manually deliver this order if necessary.</p>
    `;

    // Send to admin email (could be configured)
    const adminEmail = process.env.ADMIN_EMAIL || config.email.from;
    
    return this.sendEmail({
      to: adminEmail,
      subject: `[ALERT] Delivery Failure - ${order.order_id}`,
      html,
      text: `Delivery Failure Alert\n\nOrder ID: ${order.order_id}\nProduct: ${order.product_name}\nCharacter: ${order.character_name}\nError: ${error.message || 'Unknown error'}`
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email, resetToken, resetUrl) {
    const html = `
      <h2>Password Reset Request</h2>
      <p>You have requested to reset your password for your Heart of Acheron account.</p>
      <p>Click the link below to reset your password:</p>
      <p><a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #6b2c91; color: #ffffff; text-decoration: none; border-radius: 5px; margin: 20px 0;">Reset Password</a></p>
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #666;">${resetUrl}</p>
      <p><strong>Your reset key:</strong> <code style="background: #f0f0f0; padding: 4px 8px; border-radius: 3px; font-family: monospace;">${resetToken}</code></p>
      <p style="color: #999; font-size: 0.9em; margin-top: 30px;">This link will expire in 1 hour. If you did not request this password reset, please ignore this email.</p>
      <p style="color: #999; font-size: 0.9em;">For security reasons, this link can only be used once.</p>
    `;

    const text = `
Password Reset Request

You have requested to reset your password for your Heart of Acheron account.

Reset your password by visiting this link:
${resetUrl}

Your reset key: ${resetToken}

This link will expire in 1 hour. If you did not request this password reset, please ignore this email.

For security reasons, this link can only be used once.
    `;

    return this.sendEmail({
      to: email,
      subject: 'Password Reset Request - Heart of Acheron',
      html,
      text
    });
  }
}

module.exports = new EmailService();

