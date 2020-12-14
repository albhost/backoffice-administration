"use strict";

module.exports = function (sequelize, DataTypes) {
  const carousel_channels = sequelize.define('carousel_channels', {
      id: {
          type: DataTypes.INTEGER(11),
          allowNull: false,
          primaryKey: true,
          autoIncrement: true,
          unique: true
      },
      carousel_type: {
          type: DataTypes.STRING(128),
          allowNull: false
      },
      company_id: {
          type: DataTypes.INTEGER(11),
          allowNull: false
      },
      channel_id: {
          type: DataTypes.TEXT,
          allowNull: true,
/*          get: function () {
              try {
                  return JSON.parse(this.getDataValue('channel_id'));
              } catch (e) {
                  return null;
              }
          },
          set: function (value) {
              return this.setDataValue('channel_id', JSON.stringify(value));
          }*/
      },
      createdAt: {
          type: DataTypes.DATE
      },
      updatedAt: {
          type: DataTypes.DATE
      }
  }, {
    tableName: 'carousel_channels',
    associate: function (models) {
        carousel_channels.belongsTo(models.settings, { foreignKey: 'company_id' });
    }
  });
  return carousel_channels;
};