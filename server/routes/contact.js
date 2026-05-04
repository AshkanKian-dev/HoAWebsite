const express = require('express');
const router = express.Router();
const { createContactSubmission } = require('../database/db');
const { validateInput } = require('../middleware/security');
const { apiRateLimiter } = require('../middleware/security');
const logger = require('../utils/logger');

/**
 * Submit contact form
 */
router.post('/contact',
  apiRateLimiter,
  validateInput,
  (req, res) => {
    try {
      const { name, email, subject, message } = req.body;

      // Validate required fields
      if (!name || !email || !subject || !message) {
        return res.status(400).json({ error: 'All fields are required' });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      // Validate message length
      if (message.length < 10) {
        return res.status(400).json({ error: 'Message must be at least 10 characters long' });
      }

      if (message.length > 5000) {
        return res.status(400).json({ error: 'Message must be less than 5000 characters' });
      }

      // Create submission
      const submissionId = createContactSubmission({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        subject: subject.trim(),
        message: message.trim()
      });

      logger.info(`Contact form submission received: ${submissionId} from ${email}`);

      res.status(201).json({
        success: true,
        message: 'Thank you for your message! We will get back to you soon.',
        submissionId
      });
    } catch (error) {
      logger.error('Error processing contact form submission:', error);
      res.status(500).json({ error: 'Failed to submit contact form. Please try again later.' });
    }
  }
);

module.exports = router;
