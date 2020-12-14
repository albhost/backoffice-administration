"use strict";

module.exports = function (sequelize, DataTypes) {
  const mediaPlayer = sequelize.define('media_player', {
    id: {
      type: DataTypes.INTEGER(11),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
      unique: true
    },
    company_id: {
      type: DataTypes.INTEGER(11),
      allowNull: false
    },
    player_name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    app_id: {
      type: DataTypes.INTEGER(11),
      allowNull: false
    },
    default: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'media_player',
    associate: function (models) {
      mediaPlayer.belongsTo(models.app_group, { foreignKey: 'app_id' });
      mediaPlayer.hasMany(models.device_mediaplayer, { foreignKey: 'mediaplayer_id' });
      //mediaPlayer.belongsToMany(models.devices, { as: 'mediaplayers', through: 'device_mediaplayer' })
    }
  });
  return mediaPlayer;
};
