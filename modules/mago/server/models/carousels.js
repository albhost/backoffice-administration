"use strict";

module.exports = function (sequelize, DataTypes) {
  const carousels = sequelize.define('carousels', {
    id: {
      type: DataTypes.INTEGER(11),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
      unique: true
    },
    type: {
      type: DataTypes.INTEGER(100),
      allowNull: false
    },
    title: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    is_available: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    order_number: {
      type: DataTypes.INTEGER(2),
      allowNull: false
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'carousels',
    associate: function (models) {
      carousels.belongsTo(models.settings, { foreignKey: 'company_id' });
    }
  });
  return carousels;
};