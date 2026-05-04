const express = require('express');
const router = express.Router();
const rconService = require('../services/rcon');
const ampService = require('../services/ampService');
const config = require('../config/config');
const logger = require('../utils/logger');
const { apiRateLimiter } = require('../middleware/security');

/**
 * Get server status and information
 */
router.get('/status', apiRateLimiter, async (req, res, next) => {
  let rconError = null;
  let playersError = null;
  let ampError = null;
  let isOnline = false;
  let statusSource = 'rcon';
  
  try {
    // Try AMP first if configured, fallback to RCON
    if (ampService.isConfigured) {
      try {
        logger.info('Checking server status via AMP API...');
        const ampStatus = await ampService.getInstanceStatus();
        isOnline = ampStatus.isOnline;
        statusSource = 'amp';
        logger.info(`AMP status check: ${isOnline ? 'online' : 'offline'}`);
      } catch (error) {
        ampError = error.message;
        logger.warn('AMP status check failed, falling back to RCON:', error.message);
        // Fall through to RCON check
      }
    }
    
    // Use RCON if AMP not configured or failed
    if (!ampService.isConfigured || ampError) {
      logger.info(`Checking server status via RCON: ${config.rcon.host}:${config.rcon.port}`);
      try {
        isOnline = await rconService.healthCheck();
        statusSource = 'rcon';
      } catch (error) {
        rconError = error.message;
        logger.warn('RCON connection failed:', error.message);
        isOnline = false;
      }
    }
    
    let onlinePlayers = [];
    let playerCount = 0;
    
    // Always use RCON for player count (AMP may not provide this)
    if (isOnline) {
      try {
        logger.info('Server is online, fetching player list via RCON...');
        onlinePlayers = await rconService.getOnlinePlayers();
        playerCount = onlinePlayers.length;
        logger.info(`Found ${playerCount} online players`);
      } catch (error) {
        playersError = error.message;
        logger.warn('Could not fetch online players:', error);
        // Server is online but couldn't get player list
      }
    } else {
      if (!ampError && !rconError) {
        logger.warn('Server appears offline');
      }
    }

    // Return IP and port for connection
    const displayIp = config.server.gameIp || 'roejin.com';
    const gamePort = config.server.gamePort || 7775;
    const queryPort = config.server.queryPort || 27012;
    const connectString = `${displayIp}:${gamePort}`;

    const response = {
      success: true,
      server: {
        status: isOnline ? 'online' : 'offline',
        ip: displayIp,
        gamePort: gamePort,
        queryPort: queryPort,
        connectString: connectString,
        playerCount,
        maxPlayers: config.server.maxPlayers || 50,
        onlinePlayers: onlinePlayers.map(p => ({
          name: p.name,
          timeConnected: p.timeConnected
        }))
      }
    };

    // Add debug info in development mode
    if (process.env.NODE_ENV !== 'production') {
      response.debug = {
        statusSource: statusSource,
        rconHost: config.rcon.host,
        rconPort: config.rcon.port,
        rconError: rconError,
        ampError: ampError,
        playersError: playersError,
        connectionAttempted: true,
        ampConfigured: ampService.isConfigured
      };
    }

    res.json(response);
  } catch (error) {
    logger.error('Error fetching server status:', error);
    const displayIp = config.server.gameIp || 'roejin.com';
    const gamePort = config.server.gamePort || 7775;
    const queryPort = config.server.queryPort || 27012;
    const connectString = `${displayIp}:${gamePort}`;
    const errorResponse = {
      success: false,
      server: {
        status: 'offline',
        ip: displayIp,
        gamePort: gamePort,
        queryPort: queryPort,
        connectString: connectString,
        playerCount: 0,
        maxPlayers: config.server.maxPlayers || 50,
        onlinePlayers: []
      }
    };

    // Add debug info in development mode
    if (process.env.NODE_ENV !== 'production') {
      errorResponse.debug = {
        error: error.message,
        rconHost: config.rcon.host,
        rconPort: config.rcon.port,
        stack: error.stack,
        ampConfigured: ampService.isConfigured
      };
    }

    res.json(errorResponse);
  }
});

module.exports = router;

