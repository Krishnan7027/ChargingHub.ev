const Favorite = require('../models/Favorite');
const eventBus = require('../events/eventBus');

const favoriteService = {
  async addFavorite(userId, stationId) {
    const existing = await Favorite.findOne({ userId, stationId });
    if (existing) {
      const err = new Error('Station already favorited');
      err.statusCode = 409;
      throw err;
    }

    const favorite = await Favorite.create({ userId, stationId });

    await eventBus.publish(
      eventBus.EVENTS.FAVORITE_ADDED,
      { userId, stationId },
      { actorId: userId, entityType: 'favorite', entityId: favorite.id }
    );

    return favorite;
  },

  async removeFavorite(userId, stationId) {
    const deleted = await Favorite.delete({ userId, stationId });
    if (!deleted) {
      const err = new Error('Favorite not found');
      err.statusCode = 404;
      throw err;
    }

    await eventBus.publish(
      eventBus.EVENTS.FAVORITE_REMOVED,
      { userId, stationId },
      { actorId: userId, entityType: 'favorite', entityId: deleted.id }
    );

    return deleted;
  },

  async getUserFavorites(userId) {
    return Favorite.findByUser(userId);
  },

  async getFavoriteStatus(userId, stationId) {
    const favorite = await Favorite.findOne({ userId, stationId });
    const totalFavorites = await Favorite.countByStation(stationId);
    return {
      isFavorited: !!favorite,
      totalFavorites,
    };
  },
};

module.exports = favoriteService;
