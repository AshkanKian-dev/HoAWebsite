const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const config = require('../config/config');

// Ensure database directory exists
const dbDir = path.dirname(config.database.path);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize database
const db = new Database(config.database.path);
db.pragma('journal_mode = WAL'); // Enable Write-Ahead Logging for better performance

// Read and execute schema
const schemaPath = path.join(__dirname, 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');
db.exec(schema);

// Create default admin account if it doesn't exist
// Set ADMIN_EMAIL and ADMIN_PASSWORD in .env before first run
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@heartofacheron.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

try {
  const existingAdmin = db.prepare('SELECT user_id FROM users WHERE email = ?').get(ADMIN_EMAIL);
  if (!existingAdmin && ADMIN_PASSWORD) {
    const { v4: uuidv4 } = require('uuid');
    const bcrypt = require('bcrypt');
    const adminUserId = uuidv4();
    const passwordHash = bcrypt.hashSync(ADMIN_PASSWORD, 12);
    
    db.prepare(`
      INSERT INTO users (user_id, email, password_hash, character_name, is_admin)
      VALUES (?, ?, ?, ?, ?)
    `).run(adminUserId, ADMIN_EMAIL, passwordHash, 'Admin', 1);
    
    logger.info('Default admin account created: admin@heartofacheron.com');
  } else {
    // Ensure existing admin has admin privileges
    db.prepare('UPDATE users SET is_admin = 1 WHERE email = ?').run(ADMIN_EMAIL);
  }
} catch (error) {
  logger.error('Error creating default admin account:', error);
}

logger.info('Database initialized successfully');

// Helper functions for common operations
const dbHelpers = {
  // Purchase operations
  createPurchase: (orderData) => {
    const stmt = db.prepare(`
      INSERT INTO purchases (
        order_id, customer_email, steam_id, character_name, product_id, 
        product_name, price, payment_provider, payment_intent_id, status, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(
      orderData.order_id,
      orderData.customer_email,
      orderData.steam_id || null,
      orderData.character_name,
      orderData.product_id,
      orderData.product_name,
      orderData.price,
      orderData.payment_provider,
      orderData.payment_intent_id || null,
      orderData.status || 'pending',
      orderData.metadata ? JSON.stringify(orderData.metadata) : null
    );
  },

  getPurchase: (orderId) => {
    const stmt = db.prepare('SELECT * FROM purchases WHERE order_id = ?');
    const purchase = stmt.get(orderId);
    if (purchase && purchase.metadata) {
      purchase.metadata = JSON.parse(purchase.metadata);
    }
    return purchase;
  },

  updatePurchaseStatus: (orderId, status, deliveredAt = null) => {
    const stmt = db.prepare(`
      UPDATE purchases 
      SET status = ?, delivered_at = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE order_id = ?
    `);
    return stmt.run(status, deliveredAt, orderId);
  },

  getPurchasesByEmail: (email) => {
    const stmt = db.prepare('SELECT * FROM purchases WHERE customer_email = ? ORDER BY created_at DESC');
    return stmt.all(email).map(p => {
      if (p.metadata) p.metadata = JSON.parse(p.metadata);
      return p;
    });
  },

  // Product operations
  getProduct: (productId) => {
    const stmt = db.prepare('SELECT * FROM products WHERE product_id = ? AND active = 1');
    const product = stmt.get(productId);
    if (product && product.delivery_commands) {
      product.delivery_commands = JSON.parse(product.delivery_commands);
    }
    return product;
  },

  getAllProducts: () => {
    const stmt = db.prepare('SELECT * FROM products WHERE active = 1');
    return stmt.all().map(p => {
      if (p.delivery_commands) p.delivery_commands = JSON.parse(p.delivery_commands);
      return p;
    });
  },

  // Player operations
  createOrUpdatePlayer: (steamId, characterName, email = null) => {
    const stmt = db.prepare(`
      INSERT INTO players (steam_id, character_name, email, last_seen, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(steam_id) DO UPDATE SET
        character_name = excluded.character_name,
        email = COALESCE(excluded.email, email),
        last_seen = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    `);
    return stmt.run(steamId, characterName, email);
  },

  getPlayerByCharacterName: (characterName) => {
    const stmt = db.prepare('SELECT * FROM players WHERE character_name = ? ORDER BY last_seen DESC LIMIT 1');
    return stmt.get(characterName);
  },

  getPlayerBySteamId: (steamId) => {
    const stmt = db.prepare('SELECT * FROM players WHERE steam_id = ?');
    return stmt.get(steamId);
  },

  // Delivery log operations
  createDeliveryLog: (logData) => {
    const stmt = db.prepare(`
      INSERT INTO delivery_logs (order_id, command_executed, success, error_message, retry_attempt)
      VALUES (?, ?, ?, ?, ?)
    `);
    return stmt.run(
      logData.order_id,
      logData.command_executed,
      logData.success ? 1 : 0,
      logData.error_message || null,
      logData.retry_attempt || 0
    );
  },

  getDeliveryLogs: (orderId) => {
    const stmt = db.prepare('SELECT * FROM delivery_logs WHERE order_id = ? ORDER BY timestamp DESC');
    return stmt.all(orderId);
  },

  // Statistics
  getPendingDeliveries: () => {
    const stmt = db.prepare("SELECT * FROM purchases WHERE status IN ('pending', 'processing') ORDER BY created_at ASC");
    return stmt.all().map(p => {
      if (p.metadata) p.metadata = JSON.parse(p.metadata);
      return p;
    });
  },

  // User operations
  createUser: (userData) => {
    const { v4: uuidv4 } = require('uuid');
    const userId = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO users (user_id, email, password_hash, character_name, steam_id, steam_avatar, display_name, is_admin)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      userId,
      userData.email,
      userData.password_hash || null,
      userData.character_name,
      userData.steam_id || null,
      userData.steam_avatar || null,
      userData.display_name || null,
      userData.is_admin || 0
    );
    return userId;
  },

  getUserByEmail: (email) => {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email);
  },

  getUserById: (userId) => {
    const stmt = db.prepare('SELECT user_id, email, character_name, steam_id, steam_avatar, display_name, email_verified, created_at, last_login FROM users WHERE user_id = ?');
    return stmt.get(userId);
  },

  getUserBySteamId: (steamId) => {
    const stmt = db.prepare('SELECT user_id, email, character_name, steam_id, steam_avatar, display_name, email_verified, is_admin, banned, created_at, last_login FROM users WHERE steam_id = ?');
    return stmt.get(steamId);
  },

  updateUserLastLogin: (userId) => {
    const stmt = db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = ?');
    return stmt.run(userId);
  },

  updateUserPassword: (userId, passwordHash) => {
    const stmt = db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?');
    return stmt.run(passwordHash, userId);
  },

  // Password reset token operations
  createPasswordResetToken: (userId, token, expiresAt) => {
    const { v4: uuidv4 } = require('uuid');
    const tokenId = uuidv4();
    // Invalidate any existing tokens for this user
    const invalidateStmt = db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE user_id = ? AND used = 0');
    invalidateStmt.run(userId);
    
    // Create new token
    const stmt = db.prepare(`
      INSERT INTO password_reset_tokens (token_id, user_id, token, expires_at)
      VALUES (?, ?, ?, ?)
    `);
    return stmt.run(tokenId, userId, token, expiresAt);
  },

  getPasswordResetToken: (token) => {
    const stmt = db.prepare(`
      SELECT prt.*, u.email, u.user_id
      FROM password_reset_tokens prt
      JOIN users u ON prt.user_id = u.user_id
      WHERE prt.token = ? AND prt.used = 0 AND prt.expires_at > CURRENT_TIMESTAMP
    `);
    return stmt.get(token);
  },

  markPasswordResetTokenAsUsed: (token) => {
    const stmt = db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE token = ?');
    return stmt.run(token);
  },

  cleanupExpiredPasswordResetTokens: () => {
    const stmt = db.prepare('DELETE FROM password_reset_tokens WHERE expires_at < CURRENT_TIMESTAMP OR used = 1');
    return stmt.run();
  },

  // Session operations
  createSession: (sessionData) => {
    const { v4: uuidv4 } = require('uuid');
    const sessionId = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO sessions (session_id, user_id, token, expires_at, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(
      sessionId,
      sessionData.user_id,
      sessionData.token,
      sessionData.expires_at,
      sessionData.ip_address || null,
      sessionData.user_agent || null
    );
  },

  getSessionByToken: (token) => {
    const stmt = db.prepare('SELECT * FROM sessions WHERE token = ? AND expires_at > CURRENT_TIMESTAMP');
    return stmt.get(token);
  },

  deleteSession: (token) => {
    const stmt = db.prepare('DELETE FROM sessions WHERE token = ?');
    return stmt.run(token);
  },

  deleteUserSessions: (userId) => {
    const stmt = db.prepare('DELETE FROM sessions WHERE user_id = ?');
    return stmt.run(userId);
  },

  cleanupExpiredSessions: () => {
    const stmt = db.prepare('DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP');
    return stmt.run();
  },

  // Forum operations
  getForumCategories: () => {
    const stmt = db.prepare('SELECT * FROM forum_categories ORDER BY display_order ASC, created_at ASC');
    return stmt.all();
  },

  getForumCategory: (categoryId) => {
    const stmt = db.prepare('SELECT * FROM forum_categories WHERE category_id = ?');
    return stmt.get(categoryId);
  },

  getForumTopics: (categoryId, limit = 50, offset = 0) => {
    const stmt = db.prepare(`
      SELECT t.*, u.character_name, u.display_name, u.email
      FROM forum_topics t
      LEFT JOIN users u ON t.user_id = u.user_id
      WHERE t.category_id = ?
      ORDER BY t.pinned DESC, t.last_reply_at DESC, t.created_at DESC
      LIMIT ? OFFSET ?
    `);
    return stmt.all(categoryId, limit, offset);
  },

  getForumTopic: (topicId) => {
    const stmt = db.prepare(`
      SELECT t.*, u.character_name, u.display_name, u.email
      FROM forum_topics t
      LEFT JOIN users u ON t.user_id = u.user_id
      WHERE t.topic_id = ?
    `);
    return stmt.get(topicId);
  },

  createForumTopic: (topicData) => {
    const { v4: uuidv4 } = require('uuid');
    const topicId = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO forum_topics (topic_id, category_id, user_id, title, content)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(topicId, topicData.category_id, topicData.user_id, topicData.title, topicData.content);
    return topicId;
  },

  updateForumTopic: (topicId, updates) => {
    const fields = [];
    const values = [];
    
    if (updates.title !== undefined) {
      fields.push('title = ?');
      values.push(updates.title);
    }
    if (updates.content !== undefined) {
      fields.push('content = ?');
      values.push(updates.content);
    }
    if (updates.locked !== undefined) {
      fields.push('locked = ?');
      values.push(updates.locked);
    }
    if (updates.pinned !== undefined) {
      fields.push('pinned = ?');
      values.push(updates.pinned);
    }
    
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(topicId);
    
    const stmt = db.prepare(`UPDATE forum_topics SET ${fields.join(', ')} WHERE topic_id = ?`);
    return stmt.run(...values);
  },

  incrementTopicViews: (topicId) => {
    const stmt = db.prepare('UPDATE forum_topics SET views = views + 1 WHERE topic_id = ?');
    return stmt.run(topicId);
  },

  getForumPosts: (topicId, limit = 100, offset = 0) => {
    const stmt = db.prepare(`
      SELECT p.*, u.character_name, u.display_name, u.email
      FROM forum_posts p
      LEFT JOIN users u ON p.user_id = u.user_id
      WHERE p.topic_id = ?
      ORDER BY p.created_at ASC
      LIMIT ? OFFSET ?
    `);
    return stmt.all(topicId, limit, offset);
  },

  createForumPost: (postData) => {
    const { v4: uuidv4 } = require('uuid');
    const postId = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO forum_posts (post_id, topic_id, user_id, content)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(postId, postData.topic_id, postData.user_id, postData.content);
    
    // Update topic's last_reply_at and replies_count
    const updateStmt = db.prepare(`
      UPDATE forum_topics 
      SET last_reply_at = CURRENT_TIMESTAMP, 
          replies_count = replies_count + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE topic_id = ?
    `);
    updateStmt.run(postData.topic_id);
    
    return postId;
  },

  updateForumPost: (postId, content) => {
    const stmt = db.prepare('UPDATE forum_posts SET content = ?, edited_at = CURRENT_TIMESTAMP WHERE post_id = ?');
    return stmt.run(content, postId);
  },

  deleteForumPost: (postId) => {
    // Get topic_id before deleting
    const getStmt = db.prepare('SELECT topic_id FROM forum_posts WHERE post_id = ?');
    const post = getStmt.get(postId);
    
    if (post) {
      // Delete the post
      const deleteStmt = db.prepare('DELETE FROM forum_posts WHERE post_id = ?');
      deleteStmt.run(postId);
      
      // Update topic's replies_count (ensure it doesn't go below 0)
      const updateStmt = db.prepare(`
        UPDATE forum_topics 
        SET replies_count = CASE WHEN replies_count > 0 THEN replies_count - 1 ELSE 0 END,
            updated_at = CURRENT_TIMESTAMP
        WHERE topic_id = ?
      `);
      updateStmt.run(post.topic_id);
    }
    
    return post;
  },

  getForumPost: (postId) => {
    const stmt = db.prepare(`
      SELECT p.*, u.character_name, u.display_name, u.email
      FROM forum_posts p
      LEFT JOIN users u ON p.user_id = u.user_id
      WHERE p.post_id = ?
    `);
    return stmt.get(postId);
  },

  getTopicCount: (categoryId) => {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM forum_topics WHERE category_id = ?');
    return stmt.get(categoryId);
  },

  // Login attempts operations
  createLoginAttempt: (email, ipAddress, success = false) => {
    const stmt = db.prepare(`
      INSERT INTO login_attempts (email, ip_address, success)
      VALUES (?, ?, ?)
    `);
    return stmt.run(email, ipAddress, success ? 1 : 0);
  },

  getRecentFailedAttempts: (email, ipAddress, minutes = 15) => {
    const stmt = db.prepare(`
      SELECT COUNT(*) as count 
      FROM login_attempts 
      WHERE (email = ? OR ip_address = ?)
        AND success = 0
        AND attempted_at > datetime('now', '-' || ? || ' minutes')
    `);
    return stmt.get(email, ipAddress, minutes);
  },

  lockAccount: (email, minutes = 15) => {
    const lockedUntil = new Date();
    lockedUntil.setMinutes(lockedUntil.getMinutes() + minutes);
    const stmt = db.prepare(`
      UPDATE login_attempts 
      SET locked_until = ?
      WHERE email = ? AND attempted_at = (
        SELECT MAX(attempted_at) FROM login_attempts WHERE email = ?
      )
    `);
    return stmt.run(lockedUntil.toISOString(), email, email);
  },

  isAccountLocked: (email) => {
    const stmt = db.prepare(`
      SELECT locked_until 
      FROM login_attempts 
      WHERE email = ? 
        AND locked_until IS NOT NULL
        AND locked_until > datetime('now')
      ORDER BY attempted_at DESC 
      LIMIT 1
    `);
    const result = stmt.get(email);
    return result ? new Date(result.locked_until) : null;
  },

  clearFailedAttempts: (email) => {
    const stmt = db.prepare(`
      DELETE FROM login_attempts 
      WHERE email = ? AND success = 0
    `);
    return stmt.run(email);
  },

  cleanupOldAttempts: () => {
    // Delete attempts older than 24 hours
    const stmt = db.prepare(`
      DELETE FROM login_attempts 
      WHERE attempted_at < datetime('now', '-24 hours')
    `);
    return stmt.run();
  },

  // Contact submission operations
  createContactSubmission: (submissionData) => {
    const { v4: uuidv4 } = require('uuid');
    const submissionId = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO contact_submissions (submission_id, name, email, subject, message)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(
      submissionId,
      submissionData.name,
      submissionData.email,
      submissionData.subject,
      submissionData.message
    );
    return submissionId;
  },

  getContactSubmissions: (limit = 50, offset = 0, status = null) => {
    let query = 'SELECT * FROM contact_submissions';
    const params = [];
    
    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    const stmt = db.prepare(query);
    return stmt.all(...params);
  },

  getContactSubmission: (submissionId) => {
    const stmt = db.prepare('SELECT * FROM contact_submissions WHERE submission_id = ?');
    return stmt.get(submissionId);
  },

  updateContactSubmissionStatus: (submissionId, status, readAt = null, repliedAt = null) => {
    const fields = ['status = ?'];
    const values = [status];
    
    if (readAt !== null) {
      fields.push('read_at = ?');
      values.push(readAt);
    }
    
    if (repliedAt !== null) {
      fields.push('replied_at = ?');
      values.push(repliedAt);
    }
    
    values.push(submissionId);
    
    const stmt = db.prepare(`UPDATE contact_submissions SET ${fields.join(', ')} WHERE submission_id = ?`);
    return stmt.run(...values);
  },

  // User management operations
  getAllUsers: (limit = 50, offset = 0) => {
    const stmt = db.prepare(`
      SELECT user_id, email, character_name, steam_id, display_name, 
             email_verified, is_admin, banned, banned_at, banned_reason,
             created_at, last_login
      FROM users
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);
    return stmt.all(limit, offset);
  },

  getUserById: (userId) => {
    const stmt = db.prepare(`
      SELECT user_id, email, character_name, steam_id, display_name,
             email_verified, is_admin, banned, banned_at, banned_reason,
             created_at, updated_at, last_login
      FROM users
      WHERE user_id = ?
    `);
    return stmt.get(userId);
  },

  banUser: (userId, reason = null) => {
    const stmt = db.prepare(`
      UPDATE users 
      SET banned = 1, banned_at = CURRENT_TIMESTAMP, banned_reason = ?
      WHERE user_id = ?
    `);
    return stmt.run(reason, userId);
  },

  unbanUser: (userId) => {
    const stmt = db.prepare(`
      UPDATE users 
      SET banned = 0, banned_at = NULL, banned_reason = NULL
      WHERE user_id = ?
    `);
    return stmt.run(userId);
  }
};

module.exports = { db, ...dbHelpers };

