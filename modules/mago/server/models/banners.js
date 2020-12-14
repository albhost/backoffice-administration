"use strict";

module.exports = function(sequelize, DataTypes) {
    var model = sequelize.define('banners', {
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
            defaultValue: 1
        },
        name: {
            type: DataTypes.STRING(30),
            allowNull: false
        },
        size: {
            type: DataTypes.ENUM,
            values: ['small', 'large'],
            allowNull: false
        },
        img_url: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        link: {
            type: DataTypes.STRING(255),
            allowNull: false
        }
    }, {
        tableName: 'banners',
        associate: function(models) {
            model.belongsTo(models.settings, {foreignKey: 'company_id'});
        }
    });
    return model;
};
