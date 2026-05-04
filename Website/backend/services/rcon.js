const Rcon = require('node-rcon');
const logger = require('../utils/logger');
const config = require('../config/config');

class RconService {
  constructor() {
    this.connection = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  /**
   * Connect to RCON server
   */
  async connect() {
    if (this.isConnected && this.connection) {
      return true;
    }

    return new Promise((resolve, reject) => {
      try {
        logger.info(`Connecting to RCON at ${config.rcon.host}:${config.rcon.port}`);
        
        // Validate RCON password is set
        if (!config.rcon.password || config.rcon.password.trim() === '') {
          const error = new Error('RCON password not configured. Please set RCON_PASSWORD in .env file.');
          logger.error(error.message);
          reject(error);
          return;
        }
        
        this.connection = Rcon(config.rcon.host, config.rcon.port, config.rcon.password);
        
        let authTimeout;
        let connectionTimeout;
        
        this.connection.on('auth', () => {
          logger.info('RCON authentication successful');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          clearTimeout(authTimeout);
          clearTimeout(connectionTimeout);
          resolve(true);
        });

        this.connection.on('response', (str) => {
          logger.debug(`RCON response: ${str}`);
        });

        this.connection.on('error', (err) => {
          logger.error(`RCON error: ${err.message || err}`);
          this.isConnected = false;
          clearTimeout(authTimeout);
          clearTimeout(connectionTimeout);
          if (!this.reconnectAttempts) {
            reject(new Error(`RCON connection error: ${err.message || err}`));
          }
        });

        this.connection.on('end', () => {
          logger.warn('RCON connection ended');
          this.isConnected = false;
          this.connection = null;
          clearTimeout(authTimeout);
          clearTimeout(connectionTimeout);
        });

        this.connection.connect();
        
        // Timeout for authentication (should happen quickly)
        authTimeout = setTimeout(() => {
          if (!this.isConnected) {
            logger.error('RCON authentication timeout - check password and server accessibility');
            this.connection = null;
            reject(new Error(`RCON authentication timeout. Check if RCON is enabled and password is correct. Host: ${config.rcon.host}:${config.rcon.port}`));
          }
        }, 5000); // 5 seconds for auth
        
        // Overall connection timeout
        connectionTimeout = setTimeout(() => {
          if (!this.isConnected) {
            this.connection = null;
            clearTimeout(authTimeout);
            reject(new Error(`RCON connection timeout after ${config.rcon.timeout}ms. Check if server is accessible at ${config.rcon.host}:${config.rcon.port}`));
          }
        }, config.rcon.timeout);

      } catch (error) {
        logger.error(`RCON connection error: ${error.message || error}`);
        this.isConnected = false;
        reject(new Error(`RCON connection failed: ${error.message || error}`));
      }
    });
  }

  /**
   * Disconnect from RCON server
   */
  disconnect() {
    if (this.connection) {
      try {
        this.connection.disconnect();
      } catch (error) {
        logger.error('Error disconnecting RCON:', error);
      }
      this.connection = null;
      this.isConnected = false;
    }
  }

  /**
   * Execute a command on the server
   * @param {string} command - The RCON command to execute
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<string>} - Command response
   */
  async executeCommand(command, timeout = 10000) {
    if (!this.isConnected) {
      await this.connect();
    }

    return new Promise((resolve, reject) => {
      if (!this.connection) {
        reject(new Error('RCON connection not available'));
        return;
      }

      logger.info(`Executing RCON command: ${command}`);

      const timer = setTimeout(() => {
        reject(new Error('RCON command timeout'));
      }, timeout);

      try {
        this.connection.send(command, (response) => {
          clearTimeout(timer);
          logger.debug(`RCON command response: ${response}`);
          resolve(response || '');
        });
      } catch (error) {
        clearTimeout(timer);
        logger.error('RCON command execution error:', error);
        this.isConnected = false;
        reject(error);
      }
    });
  }

  /**
   * Get list of online players
   * @returns {Promise<Array>} - Array of player objects
   */
  async getOnlinePlayers() {
    try {
      const response = await this.executeCommand('ShowPlayers');
      return this.parsePlayerList(response);
    } catch (error) {
      logger.error('Error getting online players:', error);
      return [];
    }
  }

  /**
   * Parse player list from server response
   * Format: "name,steamid,timeconnected"
   * @param {string} response - Server response
   * @returns {Array} - Parsed player list
   */
  parsePlayerList(response) {
    const players = [];
    if (!response) return players;

    const lines = response.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      // Skip header line if present
      if (line.toLowerCase().includes('name') || line.toLowerCase().includes('steam')) {
        continue;
      }

      const parts = line.split(',').map(p => p.trim());
      if (parts.length >= 2) {
        players.push({
          name: parts[0],
          steamId: parts[1],
          timeConnected: parts[2] || null
        });
      }
    }

    return players;
  }

  /**
   * Find player by character name
   * @param {string} characterName - Character name to search for
   * @returns {Promise<Object|null>} - Player object or null
   */
  async findPlayerByName(characterName) {
    try {
      const players = await this.getOnlinePlayers();
      const player = players.find(p => 
        p.name.toLowerCase() === characterName.toLowerCase()
      );
      return player || null;
    } catch (error) {
      logger.error('Error finding player by name:', error);
      return null;
    }
  }

  /**
   * Health check - test RCON connection
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    try {
      await this.connect();
      await this.executeCommand('ServerInfo', 5000);
      return true;
    } catch (error) {
      logger.error('RCON health check failed:', error);
      return false;
    }
  }
}

// Create singleton instance
const rconService = new RconService();

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down RCON connection...');
  rconService.disconnect();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Shutting down RCON connection...');
  rconService.disconnect();
  process.exit(0);
});

module.exports = rconService;

