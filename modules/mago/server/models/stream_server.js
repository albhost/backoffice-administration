"use strict";

module.exports = function (sequelize, DataTypes) {
  const streamServer = sequelize.define('stream_server', {
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
    server_address: {
      type: DataTypes.STRING(500),
      allowNull: false
    },
    api_key: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    client_key: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    base_url: {
      type: DataTypes.STRING(500),
      allowNull: false
    },
    connections_threshold: {
      type: DataTypes.INTEGER(11),
      allowNull: false
    },
    out_rate_threshold: {
      type: DataTypes.INTEGER(11),
      allowNull: false
    },
    server_status_info: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    is_available: {
      type: DataTypes.BOOLEAN,
      allowNull: false
    }
  }, {
    tableName: 'stream_server',
    associate: function (models) {
      streamServer.belongsTo(models.settings, { foreignKey: 'company_id' });
    }
  });

  return streamServer;
};
