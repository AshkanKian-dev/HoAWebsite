const https = require('https');
const http = require('http');
const { URL } = require('url');
const logger = require('../utils/logger');
const config = require('../config/config');

class AmpService {
  constructor() {
    this.isConfigured = false;
    this.sessionId = null;
    this.sessionExpiry = null;
    this.checkConfiguration();
  }

  /**
   * Check if AMP is configured
   */
  checkConfiguration() {
    if (config.amp && config.amp.apiUrl && config.amp.username && config.amp.password) {
      this.isConfigured = true;
      logger.info('AMP service configured');
    } else {
      logger.info('AMP service not configured, will use RCON fallback');
    }
  }

  /**
   * Authenticate with AMP API and get session ID
   * @returns {Promise<string>} - Session ID
   */
  async authenticate() {
    // Return existing session if still valid (sessions typically last 30 minutes)
    if (this.sessionId && this.sessionExpiry && Date.now() < this.sessionExpiry) {
      return this.sessionId;
    }

    return new Promise((resolve, reject) => {
      try {
        const apiUrl = config.amp.apiUrl.replace(/\/$/, ''); // Remove trailing slash
        const url = new URL('/API/Core/Login', apiUrl);
        
        const loginData = JSON.stringify({
          username: config.amp.username,
          password: config.amp.password,
          rememberMe: false
        });
        
        const options = {
          hostname: url.hostname,
          port: url.port || (url.protocol === 'https:' ? 443 : 80),
          path: url.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Content-Length': Buffer.byteLength(loginData)
          }
        };

        const client = url.protocol === 'https:' ? https : http;
        
        const req = client.request(options, (res) => {
          let responseData = '';

          res.on('data', (chunk) => {
            responseData += chunk;
          });

          res.on('end', () => {
            try {
              if (res.statusCode >= 200 && res.statusCode < 300) {
                const parsed = responseData ? JSON.parse(responseData) : {};
                if (parsed.success && parsed.sessionID) {
                  this.sessionId = parsed.sessionID;
                  // Set session expiry to 25 minutes (sessions typically last 30 minutes)
                  this.sessionExpiry = Date.now() + (25 * 60 * 1000);
                  logger.info('AMP authentication successful');
                  resolve(this.sessionId);
                } else {
                  logger.error('AMP login failed:', parsed.message || parsed.error || 'Unknown error');
                  reject(new Error(parsed.message || parsed.error || 'AMP authentication failed'));
                }
              } else {
                logger.warn(`AMP login failed: ${res.statusCode} - ${responseData}`);
                reject(new Error(`AMP API error: ${res.statusCode}`));
              }
            } catch (error) {
              logger.error('Error parsing AMP login response:', error);
              reject(error);
            }
          });
        });

        req.on('error', (error) => {
          logger.error('AMP login request error:', error);
          reject(error);
        });

        req.setTimeout(10000, () => {
          req.destroy();
          reject(new Error('AMP login request timeout'));
        });

        req.write(loginData);
        req.end();
      } catch (error) {
        logger.error('AMP login setup error:', error);
        reject(error);
      }
    });
  }

  /**
   * Make HTTP request to AMP API
   * @param {string} endpoint - API endpoint path
   * @param {string} method - HTTP method (GET, POST, etc.)
   * @param {object} data - Request body data (optional)
   * @returns {Promise<object>} - API response
   */
  async makeRequest(endpoint, method = 'POST', data = null) {
    if (!this.isConfigured) {
      throw new Error('AMP service is not configured');
    }

    // Authenticate first to get session ID
    const sessionId = await this.authenticate();

    return new Promise((resolve, reject) => {
      try {
        const apiUrl = config.amp.apiUrl.replace(/\/$/, ''); // Remove trailing slash
        const url = new URL(endpoint, apiUrl);
        
        const requestData = data ? JSON.stringify(data) : null;
        
        const options = {
          hostname: url.hostname,
          port: url.port || (url.protocol === 'https:' ? 443 : 80),
          path: url.pathname + url.search,
          method: method,
          headers: {
            'Authorization': `Bearer ${sessionId}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        };

        if (requestData) {
          options.headers['Content-Length'] = Buffer.byteLength(requestData);
        }

        const client = url.protocol === 'https:' ? https : http;
        
        const req = client.request(options, (res) => {
          let responseData = '';

          res.on('data', (chunk) => {
            responseData += chunk;
          });

          res.on('end', () => {
            try {
              if (res.statusCode >= 200 && res.statusCode < 300) {
                const parsed = responseData ? JSON.parse(responseData) : {};
                
                // Check if response indicates authentication failure
                if (parsed.success === false && (parsed.message || parsed.error)) {
                  // Session might have expired, clear it and retry once
                  if (res.statusCode === 401 || parsed.message?.toLowerCase().includes('auth')) {
                    logger.warn('AMP session expired, will re-authenticate on next request');
                    this.sessionId = null;
                    this.sessionExpiry = null;
                  }
                  reject(new Error(parsed.message || parsed.error || 'AMP API request failed'));
                  return;
                }
                
                resolve(parsed);
              } else {
                // If 401, clear session for re-authentication
                if (res.statusCode === 401) {
                  this.sessionId = null;
                  this.sessionExpiry = null;
                }
                logger.warn(`AMP API request failed: ${res.statusCode} - ${responseData}`);
                reject(new Error(`AMP API error: ${res.statusCode}`));
              }
            } catch (error) {
              logger.error('Error parsing AMP API response:', error);
              reject(error);
            }
          });
        });

        req.on('error', (error) => {
          logger.error('AMP API request error:', error);
          reject(error);
        });

        req.setTimeout(10000, () => {
          req.destroy();
          reject(new Error('AMP API request timeout'));
        });

        if (requestData) {
          req.write(requestData);
        }

        req.end();
      } catch (error) {
        logger.error('AMP API request setup error:', error);
        reject(error);
      }
    });
  }

  /**
   * Get instance status from AMP
   * @returns {Promise<object>} - Instance status
   */
  async getInstanceStatus() {
    try {
      // AMP Core.GetStatus returns status of the current instance
      // No need for instance ID if we're querying the instance we're logged into
      const response = await this.makeRequest('/API/Core/GetStatus', 'POST');
      logger.info('AMP instance status retrieved via Core.GetStatus');
      
      // Check if response indicates instance is running
      const isOnline = this.parseStatus(response);
      
      return {
        isOnline: isOnline,
        status: response,
        source: 'amp'
      };
    } catch (error) {
      logger.warn('AMP status check failed:', error.message);
      throw error;
    }
  }

  /**
   * Parse status from AMP API response
   * AMP Core.GetStatus returns state information
   * @param {object} response - AMP API response
   * @returns {boolean} - True if instance is running
   */
  parseStatus(response) {
    if (!response) return false;

    // AMP Core.GetStatus returns StateCode:
    // 0 = Stopped
    // 1 = Starting
    // 2 = Running
    // 3 = Stopping
    // 4 = Restarting
    // 5 = Updating
    const stateCode = response.StateCode || response.stateCode || response.State || response.state;
    
    // State 2 (Running) means the instance is online
    if (stateCode === 2) {
      return true;
    }

    // Also check for State field as string
    const state = response.State || response.state;
    const runningStates = ['Running', 'running', '2'];
    if (runningStates.includes(String(state))) {
      return true;
    }

    // Check Status field if present
    const status = response.Status || response.status;
    if (status === 'Running' || status === 'running' || status === 2) {
      return true;
    }

    // Default to false if unclear
    return false;
  }

  /**
   * Health check - test AMP connection
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    if (!this.isConfigured) {
      return false;
    }

    try {
      // Try to get instance status
      await this.getInstanceStatus();
      return true;
    } catch (error) {
      logger.warn('AMP health check failed:', error.message);
      return false;
    }
  }
}

// Create singleton instance
const ampService = new AmpService();

module.exports = ampService;
