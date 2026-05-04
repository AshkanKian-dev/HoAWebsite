const express = require('express');
const router = express.Router();
const { authenticate, optionalAuth } = require('../middleware/auth');
const {
  getForumCategories,
  getForumCategory,
  getForumTopics,
  getForumTopic,
  createForumTopic,
  updateForumTopic,
  incrementTopicViews,
  getForumPosts,
  createForumPost,
  updateForumPost,
  deleteForumPost,
  getForumPost,
  getTopicCount
} = require('../database/db');
const logger = require('../utils/logger');
const { apiRateLimiter, validateInput } = require('../middleware/security');
const { sanitizeForumContent } = require('../middleware/sanitize');

/**
 * Get all forum categories
 */
router.get('/categories', optionalAuth, async (req, res, next) => {
  try {
    const categories = getForumCategories();
    
    // Get topic counts for each category
    const categoriesWithCounts = categories.map(category => {
      const count = getTopicCount(category.category_id);
      return {
        ...category,
        topic_count: count ? count.count : 0
      };
    });

    res.json({
      success: true,
      categories: categoriesWithCounts
    });
  } catch (error) {
    logger.error('Get forum categories error:', error);
    next(error);
  }
});

/**
 * Get topics in a category
 */
router.get('/topics/:categoryId', optionalAuth, async (req, res, next) => {
  try {
    const { categoryId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    // Verify category exists
    const category = getForumCategory(categoryId);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const topics = getForumTopics(categoryId, limit, offset);
    const totalCount = getTopicCount(categoryId);

    res.json({
      success: true,
      category,
      topics,
      total: totalCount ? totalCount.count : 0,
      limit,
      offset
    });
  } catch (error) {
    logger.error('Get forum topics error:', error);
    next(error);
  }
});

/**
 * Get a single topic with its posts
 */
router.get('/topic/:topicId', optionalAuth, async (req, res, next) => {
  try {
    const { topicId } = req.params;
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    const topic = getForumTopic(topicId);
    if (!topic) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    // Increment view count (only if not the author viewing)
    if (!req.user || req.user.userId !== topic.user_id) {
      incrementTopicViews(topicId);
    }

    const posts = getForumPosts(topicId, limit, offset);

    res.json({
      success: true,
      topic,
      posts,
      limit,
      offset
    });
  } catch (error) {
    logger.error('Get forum topic error:', error);
    next(error);
  }
});

/**
 * Create a new topic
 */
router.post('/topic',
  authenticate,
  apiRateLimiter,
  validateInput,
  sanitizeForumContent,
  async (req, res, next) => {
    try {
      const { category_id, title, content } = req.body;

      if (!category_id || !title || !content) {
        return res.status(400).json({ error: 'Category ID, title, and content are required' });
      }

      if (title.trim().length < 3) {
        return res.status(400).json({ error: 'Title must be at least 3 characters' });
      }

      if (content.trim().length < 10) {
        return res.status(400).json({ error: 'Content must be at least 10 characters' });
      }

      // Verify category exists
      const category = getForumCategory(category_id);
      if (!category) {
        return res.status(404).json({ error: 'Category not found' });
      }

      const topicId = createForumTopic({
        category_id,
        user_id: req.user.userId,
        title: title.trim(),
        content: content.trim()
      });

      const topic = getForumTopic(topicId);

      logger.info(`New forum topic created: ${topicId} by user ${req.user.userId}`);

      res.status(201).json({
        success: true,
        topic
      });
    } catch (error) {
      logger.error('Create forum topic error:', error);
      next(error);
    }
  }
);

/**
 * Update a topic (title, content, locked, pinned)
 */
router.put('/topic/:topicId',
  authenticate,
  apiRateLimiter,
  validateInput,
  sanitizeForumContent,
  async (req, res, next) => {
    try {
      const { topicId } = req.params;
      const { title, content, locked, pinned } = req.body;

      const topic = getForumTopic(topicId);
      if (!topic) {
        return res.status(404).json({ error: 'Topic not found' });
      }

      // Only author or admin can edit
      if (topic.user_id !== req.user.userId) {
        return res.status(403).json({ error: 'You can only edit your own topics' });
      }

      const updates = {};
      if (title !== undefined) {
        if (title.trim().length < 3) {
          return res.status(400).json({ error: 'Title must be at least 3 characters' });
        }
        updates.title = title.trim();
      }
      if (content !== undefined) {
        if (content.trim().length < 10) {
          return res.status(400).json({ error: 'Content must be at least 10 characters' });
        }
        updates.content = content.trim();
      }
      // Note: locked and pinned typically require admin privileges, but for now allowing topic author
      if (locked !== undefined) updates.locked = locked ? 1 : 0;
      if (pinned !== undefined) updates.pinned = pinned ? 1 : 0;

      updateForumTopic(topicId, updates);
      const updatedTopic = getForumTopic(topicId);

      logger.info(`Forum topic updated: ${topicId} by user ${req.user.userId}`);

      res.json({
        success: true,
        topic: updatedTopic
      });
    } catch (error) {
      logger.error('Update forum topic error:', error);
      next(error);
    }
  }
);

/**
 * Increment topic view count
 */
router.put('/topic/:topicId/view', optionalAuth, async (req, res, next) => {
  try {
    const { topicId } = req.params;

    const topic = getForumTopic(topicId);
    if (!topic) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    // Only increment if not the author
    if (!req.user || req.user.userId !== topic.user_id) {
      incrementTopicViews(topicId);
    }

    res.json({
      success: true
    });
  } catch (error) {
    logger.error('Increment topic views error:', error);
    next(error);
  }
});

/**
 * Create a new post (reply) in a topic
 */
router.post('/post',
  authenticate,
  apiRateLimiter,
  validateInput,
  sanitizeForumContent,
  async (req, res, next) => {
    try {
      const { topic_id, content } = req.body;

      if (!topic_id || !content) {
        return res.status(400).json({ error: 'Topic ID and content are required' });
      }

      if (content.trim().length < 10) {
        return res.status(400).json({ error: 'Content must be at least 10 characters' });
      }

      // Verify topic exists and is not locked
      const topic = getForumTopic(topic_id);
      if (!topic) {
        return res.status(404).json({ error: 'Topic not found' });
      }

      if (topic.locked === 1) {
        return res.status(403).json({ error: 'This topic is locked' });
      }

      const postId = createForumPost({
        topic_id,
        user_id: req.user.userId,
        content: content.trim()
      });

      const post = getForumPost(postId);

      logger.info(`New forum post created: ${postId} by user ${req.user.userId}`);

      res.status(201).json({
        success: true,
        post
      });
    } catch (error) {
      logger.error('Create forum post error:', error);
      next(error);
    }
  }
);

/**
 * Update a post
 */
router.put('/post/:postId',
  authenticate,
  apiRateLimiter,
  validateInput,
  sanitizeForumContent,
  async (req, res, next) => {
    try {
      const { postId } = req.params;
      const { content } = req.body;

      if (!content) {
        return res.status(400).json({ error: 'Content is required' });
      }

      if (content.trim().length < 10) {
        return res.status(400).json({ error: 'Content must be at least 10 characters' });
      }

      const post = getForumPost(postId);
      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }

      // Only author can edit
      if (post.user_id !== req.user.userId) {
        return res.status(403).json({ error: 'You can only edit your own posts' });
      }

      updateForumPost(postId, content.trim());
      const updatedPost = getForumPost(postId);

      logger.info(`Forum post updated: ${postId} by user ${req.user.userId}`);

      res.json({
        success: true,
        post: updatedPost
      });
    } catch (error) {
      logger.error('Update forum post error:', error);
      next(error);
    }
  }
);

/**
 * Delete a post
 */
router.delete('/post/:postId',
  authenticate,
  apiRateLimiter,
  async (req, res, next) => {
    try {
      const { postId } = req.params;

      const post = getForumPost(postId);
      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }

      // Only author can delete (or admin in future)
      if (post.user_id !== req.user.userId) {
        return res.status(403).json({ error: 'You can only delete your own posts' });
      }

      deleteForumPost(postId);

      logger.info(`Forum post deleted: ${postId} by user ${req.user.userId}`);

      res.json({
        success: true,
        message: 'Post deleted successfully'
      });
    } catch (error) {
      logger.error('Delete forum post error:', error);
      next(error);
    }
  }
);

module.exports = router;

