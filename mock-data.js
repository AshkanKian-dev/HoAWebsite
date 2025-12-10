// Mock Data Service - Provides sample data for developer mode

/**
 * Generate mock user profile data
 */
function getMockUserProfile() {
    return {
        userId: 'mock_user_12345',
        email: 'developer@example.com',
        characterName: 'TestCharacter',
        steamId: '76561198000000000',
        displayName: 'Test Player',
        emailVerified: true,
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
        lastLogin: new Date().toISOString()
    };
}

/**
 * Generate mock orders/transactions
 */
function getMockOrders() {
    const orders = JSON.parse(localStorage.getItem('mockTransactions') || '[]');
    
    // If no orders exist, create some sample ones
    if (orders.length === 0) {
        const sampleOrders = [
            {
                order_id: 'mock_order_001',
                customer_email: 'developer@example.com',
                steam_id: '76561198000000000',
                character_name: 'TestCharacter',
                product_id: 'weapon',
                product_name: 'Legendary Weapon',
                price: 5.00,
                payment_provider: 'stripe',
                payment_intent_id: 'pi_mock_001',
                status: 'delivered',
                created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
                delivered_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 5 * 60 * 1000).toISOString()
            },
            {
                order_id: 'mock_order_002',
                customer_email: 'developer@example.com',
                steam_id: '76561198000000000',
                character_name: 'TestCharacter',
                product_id: 'armor',
                product_name: 'Elite Armor Set',
                price: 8.00,
                payment_provider: 'paypal',
                payment_intent_id: 'paypal_mock_002',
                status: 'delivered',
                created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
                delivered_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 + 3 * 60 * 1000).toISOString()
            },
            {
                order_id: 'mock_order_003',
                customer_email: 'developer@example.com',
                steam_id: '76561198000000000',
                character_name: 'TestCharacter',
                product_id: 'vip',
                product_name: 'VIP Status (1 Month)',
                price: 15.00,
                payment_provider: 'stripe',
                payment_intent_id: 'pi_mock_003',
                status: 'processing',
                created_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
            }
        ];
        
        localStorage.setItem('mockTransactions', JSON.stringify(sampleOrders));
        return sampleOrders;
    }
    
    return orders;
}

/**
 * Add mock order
 */
function addMockOrder(orderData) {
    const orders = getMockOrders();
    orders.push({
        ...orderData,
        order_id: orderData.order_id || 'mock_order_' + Date.now(),
        created_at: new Date().toISOString(),
        status: orderData.status || 'delivered',
        delivered_at: orderData.delivered_at || new Date().toISOString()
    });
    localStorage.setItem('mockTransactions', JSON.stringify(orders));
    return orders[orders.length - 1];
}

/**
 * Generate mock forum categories
 */
function getMockForumCategories() {
    return [
        {
            category_id: 'general',
            name: 'General Discussion',
            description: 'General topics and discussions about the server',
            display_order: 1,
            topic_count: 12
        },
        {
            category_id: 'announcements',
            name: 'Announcements',
            description: 'Server announcements and news',
            display_order: 2,
            topic_count: 5
        },
        {
            category_id: 'support',
            name: 'Support',
            description: 'Get help with server-related issues',
            display_order: 3,
            topic_count: 8
        },
        {
            category_id: 'suggestions',
            name: 'Suggestions',
            description: 'Share your ideas and suggestions for the server',
            display_order: 4,
            topic_count: 15
        },
        {
            category_id: 'trading',
            name: 'Trading',
            description: 'Buy, sell, and trade items with other players',
            display_order: 5,
            topic_count: 20
        },
        {
            category_id: 'clans',
            name: 'Clans & Guilds',
            description: 'Find or create clans and guilds',
            display_order: 6,
            topic_count: 7
        },
        {
            category_id: 'off-topic',
            name: 'Off-Topic',
            description: 'Non-server related discussions',
            display_order: 7,
            topic_count: 10
        }
    ];
}

/**
 * Generate mock forum topics
 */
function getMockForumTopics(categoryId) {
    const storageKey = `mockForumTopics_${categoryId}`;
    let topics = JSON.parse(localStorage.getItem(storageKey) || '[]');
    
    if (topics.length === 0 && categoryId === 'general') {
        // Create sample topics for general category
        topics = [
            {
                topic_id: 'mock_topic_001',
                category_id: 'general',
                user_id: 'mock_user_12345',
                title: 'Welcome to Heart of Acheron!',
                content: 'Welcome everyone to our amazing server! We hope you enjoy your time here.',
                views: 150,
                replies_count: 8,
                last_reply_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                pinned: 1,
                locked: 0,
                created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                character_name: 'TestCharacter',
                display_name: 'Test Player',
                email: 'developer@example.com'
            },
            {
                topic_id: 'mock_topic_002',
                category_id: 'general',
                user_id: 'mock_user_12345',
                title: 'Server Rules and Guidelines',
                content: 'Please read our server rules before playing. We expect all players to follow these guidelines.',
                views: 89,
                replies_count: 3,
                last_reply_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
                pinned: 1,
                locked: 0,
                created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
                character_name: 'TestCharacter',
                display_name: 'Test Player',
                email: 'developer@example.com'
            },
            {
                topic_id: 'mock_topic_003',
                category_id: 'general',
                user_id: 'mock_user_12345',
                title: 'What are you building?',
                content: 'Share screenshots of your builds! I\'d love to see what everyone is creating.',
                views: 45,
                replies_count: 12,
                last_reply_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
                pinned: 0,
                locked: 0,
                created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
                character_name: 'TestCharacter',
                display_name: 'Test Player',
                email: 'developer@example.com'
            }
        ];
        localStorage.setItem(storageKey, JSON.stringify(topics));
    }
    
    return topics;
}

/**
 * Generate mock forum posts for a topic
 */
function getMockForumPosts(topicId) {
    const storageKey = `mockForumPosts_${topicId}`;
    let posts = JSON.parse(localStorage.getItem(storageKey) || '[]');
    
    if (posts.length === 0 && topicId === 'mock_topic_001') {
        // Create sample posts for first topic
        posts = [
            {
                post_id: 'mock_post_001',
                topic_id: topicId,
                user_id: 'mock_user_12345',
                content: 'Welcome everyone to our amazing server! We hope you enjoy your time here.',
                created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                edited_at: null,
                character_name: 'TestCharacter',
                display_name: 'Test Player',
                email: 'developer@example.com'
            },
            {
                post_id: 'mock_post_002',
                topic_id: topicId,
                user_id: 'mock_user_12345',
                content: 'Thanks for the warm welcome! Excited to be here.',
                created_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
                edited_at: null,
                character_name: 'TestCharacter',
                display_name: 'Test Player',
                email: 'developer@example.com'
            },
            {
                post_id: 'mock_post_003',
                topic_id: topicId,
                user_id: 'mock_user_12345',
                content: 'This server looks amazing! Can\'t wait to explore.',
                created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
                edited_at: null,
                character_name: 'TestCharacter',
                display_name: 'Test Player',
                email: 'developer@example.com'
            }
        ];
        localStorage.setItem(storageKey, JSON.stringify(posts));
    }
    
    return posts;
}

/**
 * Add mock forum topic
 */
function addMockForumTopic(topicData) {
    const storageKey = `mockForumTopics_${topicData.category_id}`;
    const topics = getMockForumTopics(topicData.category_id);
    
    const newTopic = {
        ...topicData,
        topic_id: topicData.topic_id || 'mock_topic_' + Date.now(),
        views: 0,
        replies_count: 0,
        pinned: 0,
        locked: 0,
        created_at: new Date().toISOString(),
        character_name: 'TestCharacter',
        display_name: 'Test Player',
        email: 'developer@example.com'
    };
    
    topics.push(newTopic);
    localStorage.setItem(storageKey, JSON.stringify(topics));
    return newTopic;
}

/**
 * Add mock forum post
 */
function addMockForumPost(postData) {
    const storageKey = `mockForumPosts_${postData.topic_id}`;
    const posts = getMockForumPosts(postData.topic_id);
    
    const newPost = {
        ...postData,
        post_id: postData.post_id || 'mock_post_' + Date.now(),
        created_at: new Date().toISOString(),
        edited_at: null,
        character_name: 'TestCharacter',
        display_name: 'Test Player',
        email: 'developer@example.com'
    };
    
    posts.push(newPost);
    localStorage.setItem(storageKey, JSON.stringify(posts));
    
    // Update topic's replies_count
    const topicStorageKey = `mockForumTopics_${postData.category_id || 'general'}`;
    const topics = JSON.parse(localStorage.getItem(topicStorageKey) || '[]');
    const topic = topics.find(t => t.topic_id === postData.topic_id);
    if (topic) {
        topic.replies_count = (topic.replies_count || 0) + 1;
        topic.last_reply_at = new Date().toISOString();
        localStorage.setItem(topicStorageKey, JSON.stringify(topics));
    }
    
    return newPost;
}

/**
 * Clear all mock data
 */
function clearMockData() {
    localStorage.removeItem('mockTransactions');
    localStorage.removeItem('mockUsers');
    localStorage.removeItem('mockSession');
    
    // Clear forum data
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
        if (key.startsWith('mockForumTopics_') || key.startsWith('mockForumPosts_')) {
            localStorage.removeItem(key);
        }
    });
    
    console.log('All mock data cleared');
}

// Expose to window
window.mockData = {
    getUserProfile: getMockUserProfile,
    getOrders: getMockOrders,
    addOrder: addMockOrder,
    getForumCategories: getMockForumCategories,
    getForumTopics: getMockForumTopics,
    getForumPosts: getMockForumPosts,
    addForumTopic: addMockForumTopic,
    addForumPost: addMockForumPost,
    clear: clearMockData
};

