"use strict";

module.exports = function (sequelize, DataTypes) {
  const programContent = sequelize.define('program_content', {
    id: {
      type: DataTypes.INTEGER(11),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
      unique: true
    },
    company_id: {
      type: DataTypes.INTEGER(11),
      allowNull: false,
      defaultValue: 1,
      unique: 'company_id_title_unique_constraint'
    },
    channel_id: {
      type: DataTypes.INTEGER(11),
      allowNull: false
    },
    title: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: 'company_id_title_unique_constraint'
    },
    icon_url: {
      type: DataTypes.STRING(255),
      allowNull: true
    }
  }, {
    tableName: 'program_content',
    associate: function (models) {
      programContent.belongsTo(models.settings, {foreignKey: 'company_id'});
      programContent.belongsTo(models.channels, {foreignKey: 'channel_id'});
    }
  });
  return programContent;
};
