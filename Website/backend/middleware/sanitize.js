const createDOMPurify = require('isomorphic-dompurify');
const DOMPurify = createDOMPurify();

/**
 * Sanitize HTML content to prevent XSS attacks
 * @param {string} html - HTML string to sanitize
 * @param {Object} options - Sanitization options
 * @returns {string} - Sanitized HTML
 */
function sanitizeHtml(html, options = {}) {
  if (!html || typeof html !== 'string') {
    return '';
  }

  const defaultOptions = {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre'],
    ALLOWED_ATTR: ['href', 'title'],
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
  };

  const sanitizeOptions = { ...defaultOptions, ...options };
  return DOMPurify.sanitize(html, sanitizeOptions);
}

/**
 * Sanitize plain text (remove all HTML)
 * @param {string} text - Text to sanitize
 * @returns {string} - Plain text without HTML
 */
function sanitizeText(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}

/**
 * Middleware to sanitize request body fields
 * @param {Array} fields - Array of field names to sanitize
 * @param {Object} options - Sanitization options
 */
function sanitizeFields(fields = [], options = {}) {
  return (req, res, next) => {
    if (req.body && Array.isArray(fields)) {
      fields.forEach(field => {
        if (req.body[field] && typeof req.body[field] === 'string') {
          // For forum content, allow some HTML tags
          if (field === 'content' || field === 'title') {
            req.body[field] = sanitizeHtml(req.body[field], options);
          } else {
            // For other fields, strip all HTML
            req.body[field] = sanitizeText(req.body[field]);
          }
        }
      });
    }
    next();
  };
}

/**
 * Sanitize forum content (allows limited HTML)
 */
function sanitizeForumContent(req, res, next) {
  if (req.body) {
    if (req.body.title) {
      req.body.title = sanitizeText(req.body.title); // Titles should be plain text
    }
    if (req.body.content) {
      req.body.content = sanitizeHtml(req.body.content, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre'],
        ALLOWED_ATTR: ['href', 'title']
      });
    }
  }
  next();
}

module.exports = {
  sanitizeHtml,
  sanitizeText,
  sanitizeFields,
  sanitizeForumContent
};

