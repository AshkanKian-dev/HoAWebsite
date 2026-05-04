const rconService = require('./rcon');
const { getPlayerByCharacterName, getPlayerBySteamId, createOrUpdatePlayer } = require('../database/db');
const logger = require('../utils/logger');

class PlayerLookupService {
  /**
   * Find player by character name
   * First checks online players, then database
   * @param {string} characterName - Character name to lookup
   * @returns {Promise<Object|null>} - Player object with steamId and characterName
   */
  async findPlayer(characterName) {
    if (!characterName || typeof characterName !== 'string') {
      throw new Error('Invalid character name provided');
    }

    logger.info(`Looking up player: ${characterName}`);

    // First, try to find online player
    try {
      const onlinePlayer = await rconService.findPlayerByName(characterName);
      if (onlinePlayer) {
        logger.info(`Found online player: ${onlinePlayer.name} (${onlinePlayer.steamId})`);
        
        // Update database with latest info
        await createOrUpdatePlayer(onlinePlayer.steamId, onlinePlayer.name);
        
        return {
          steamId: onlinePlayer.steamId,
          characterName: onlinePlayer.name,
          isOnline: true
        };
      }
    } catch (error) {
      logger.warn('Error checking online players, falling back to database:', error.message);
    }

    // Fallback to database lookup
    const dbPlayer = await getPlayerByCharacterName(characterName);
    if (dbPlayer) {
      logger.info(`Found player in database: ${dbPlayer.character_name} (${dbPlayer.steam_id})`);
      return {
        steamId: dbPlayer.steam_id,
        characterName: dbPlayer.character_name,
        isOnline: false
      };
    }

    logger.warn(`Player not found: ${characterName}`);
    return null;
  }

  /**
   * Get Steam ID for a character name
   * @param {string} characterName - Character name
   * @returns {Promise<string|null>} - Steam ID or null
   */
  async getSteamId(characterName) {
    const player = await this.findPlayer(characterName);
    return player ? player.steamId : null;
  }

  /**
   * Verify player exists (online or in database)
   * @param {string} characterName - Character name to verify
   * @returns {Promise<boolean>}
   */
  async verifyPlayerExists(characterName) {
    const player = await this.findPlayer(characterName);
    return player !== null;
  }

  /**
   * Update player information in database
   * @param {string} steamId - Steam ID
   * @param {string} characterName - Character name
   * @param {string} email - Email (optional)
   */
  async updatePlayer(steamId, characterName, email = null) {
    await createOrUpdatePlayer(steamId, characterName, email);
    logger.info(`Updated player: ${characterName} (${steamId})`);
  }

  /**
   * Get all online players
   * @returns {Promise<Array>}
   */
  async getOnlinePlayers() {
    try {
      return await rconService.getOnlinePlayers();
    } catch (error) {
      logger.error('Error getting online players:', error);
      return [];
    }
  }
}

module.exports = new PlayerLookupService();

