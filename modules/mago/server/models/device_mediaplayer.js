"use strict";

module.exports = function (sequelize, Sequelize) {
  const deviceMediaPlayer = sequelize.define('device_mediaplayer', {
    device_id: {
      type: Sequelize.INTEGER(11),
      primaryKey: true,
      allowNull: false
    },
    mediaplayer_id: {
      type: Sequelize.INTEGER(11),
      primaryKey: true,
      allowNull: false
    }
  }, {
    timestamps: false,
    tableName: 'device_mediaplayer',
    associate: function (models) {
      deviceMediaPlayer.belongsTo(models.devices, { foreignKey: 'device_id' });
      deviceMediaPlayer.belongsTo(models.media_player, { foreignKey: 'mediaplayer_id' });
    }
  });
  return deviceMediaPlayer;
};
