-- Heart of Acheron Database Schema

-- Products table
CREATE TABLE IF NOT EXISTS products (
    product_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('donation', 'item', 'perk')),
    description TEXT,
    delivery_commands TEXT NOT NULL, -- JSON array of RCON commands
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Players table
CREATE TABLE IF NOT EXISTS players (
    steam_id TEXT PRIMARY KEY,
    character_name TEXT NOT NULL,
    email TEXT,
    last_seen DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Purchases/Orders table
CREATE TABLE IF NOT EXISTS purchases (
    order_id TEXT PRIMARY KEY,
    customer_email TEXT NOT NULL,
    steam_id TEXT,
    character_name TEXT NOT NULL,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    price REAL NOT NULL,
    payment_provider TEXT NOT NULL CHECK(payment_provider IN ('stripe', 'paypal')),
    payment_intent_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'delivered', 'failed', 'refunded')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    delivered_at DATETIME,
    metadata TEXT, -- JSON for additional data
    FOREIGN KEY (product_id) REFERENCES products(product_id)
);

-- Delivery logs table
CREATE TABLE IF NOT EXISTS delivery_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL,
    command_executed TEXT NOT NULL,
    success INTEGER NOT NULL CHECK(success IN (0, 1)),
    error_message TEXT,
    retry_attempt INTEGER DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES purchases(order_id)
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    character_name TEXT NOT NULL,
    steam_id TEXT,
    steam_avatar TEXT,
    display_name TEXT,
    email_verified INTEGER DEFAULT 0,
    is_admin INTEGER DEFAULT 0,
    banned INTEGER DEFAULT 0,
    banned_at DATETIME,
    banned_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,
    user_agent TEXT,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Forum Categories table
CREATE TABLE IF NOT EXISTS forum_categories (
    category_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    display_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Forum Topics table
CREATE TABLE IF NOT EXISTS forum_topics (
    topic_id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    views INTEGER DEFAULT 0,
    replies_count INTEGER DEFAULT 0,
    last_reply_at DATETIME,
    pinned INTEGER DEFAULT 0 CHECK(pinned IN (0, 1)),
    locked INTEGER DEFAULT 0 CHECK(locked IN (0, 1)),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES forum_categories(category_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Forum Posts table (replies to topics)
CREATE TABLE IF NOT EXISTS forum_posts (
    post_id TEXT PRIMARY KEY,
    topic_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    edited_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (topic_id) REFERENCES forum_topics(topic_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Forum Post Likes table (optional)
CREATE TABLE IF NOT EXISTS forum_post_likes (
    like_id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES forum_posts(post_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE(post_id, user_id)
);

-- Login attempts table for brute force protection
CREATE TABLE IF NOT EXISTS login_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    success INTEGER DEFAULT 0 CHECK(success IN (0, 1)),
    attempted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    locked_until DATETIME
);

-- Password reset tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    token_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    used INTEGER DEFAULT 0 CHECK(used IN (0, 1)),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Contact form submissions table
CREATE TABLE IF NOT EXISTS contact_submissions (
    submission_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'new' CHECK(status IN ('new', 'read', 'replied', 'archived')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    read_at DATETIME,
    replied_at DATETIME
);

-- Create indexes for login attempts
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_login_attempts_attempted_at ON login_attempts(attempted_at);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);
CREATE INDEX IF NOT EXISTS idx_purchases_email ON purchases(customer_email);
CREATE INDEX IF NOT EXISTS idx_purchases_steam_id ON purchases(steam_id);
CREATE INDEX IF NOT EXISTS idx_purchases_character_name ON purchases(character_name);
CREATE INDEX IF NOT EXISTS idx_players_character_name ON players(character_name);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_order_id ON delivery_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_forum_topics_category_id ON forum_topics(category_id);
CREATE INDEX IF NOT EXISTS idx_forum_topics_user_id ON forum_topics(user_id);
CREATE INDEX IF NOT EXISTS idx_forum_topics_created_at ON forum_topics(created_at);
CREATE INDEX IF NOT EXISTS idx_forum_posts_topic_id ON forum_posts(topic_id);
CREATE INDEX IF NOT EXISTS idx_forum_posts_user_id ON forum_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_forum_post_likes_post_id ON forum_post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_forum_post_likes_user_id ON forum_post_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_status ON contact_submissions(status);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_created_at ON contact_submissions(created_at);
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin);
CREATE INDEX IF NOT EXISTS idx_users_banned ON users(banned);

-- Insert default products (examples)
INSERT OR IGNORE INTO products (product_id, name, price, type, description, delivery_commands) VALUES
('supporter', 'Supporter Package', 10.00, 'donation', 'Show your support for the server', '[]'),
('hero', 'Hero Package', 25.00, 'donation', 'Become a hero of the server', '[]'),
('legend', 'Legend Package', 50.00, 'donation', 'The ultimate support package', '[]'),
('weapon', 'Legendary Weapon', 5.00, 'item', 'Powerful weapon to aid you', '["GiveItemToPlayer {STEAM_ID} BP_Weapon_Sword_01 1"]'),
('armor', 'Elite Armor Set', 8.00, 'item', 'Complete armor set', '["GiveItemToPlayer {STEAM_ID} BP_Armor_01 1", "GiveItemToPlayer {STEAM_ID} BP_Armor_02 1", "GiveItemToPlayer {STEAM_ID} BP_Armor_03 1"]'),
('resources', 'Resource Pack', 3.00, 'item', 'Essential resources', '["GiveItemToPlayer {STEAM_ID} BP_Resource_Iron 1000", "GiveItemToPlayer {STEAM_ID} BP_Resource_Stone 1000"]'),
('vip', 'VIP Status (1 Month)', 15.00, 'perk', 'Enjoy VIP benefits', '[]'),
('boost', 'Experience Boost (7 Days)', 7.00, 'perk', 'Double your experience gain', '[]'),
('custom', 'Custom Name Color', 4.00, 'perk', 'Stand out with a custom colored name', '[]');

-- Insert default forum categories
INSERT OR IGNORE INTO forum_categories (category_id, name, description, display_order) VALUES
('general', 'General Discussion', 'General topics and discussions about the server', 1),
('announcements', 'Announcements', 'Server announcements and news', 2),
('support', 'Support', 'Get help with server-related issues', 3),
('suggestions', 'Suggestions', 'Share your ideas and suggestions for the server', 4),
('trading', 'Trading', 'Buy, sell, and trade items with other players', 5),
('clans', 'Clans & Guilds', 'Find or create clans and guilds', 6),
('off-topic', 'Off-Topic', 'Non-server related discussions', 7);

