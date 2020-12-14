"use strict";

module.exports = function(sequelize, DataTypes) {
    var notifications = sequelize.define('notifications', {
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
        username: {
            type: DataTypes.STRING(32),
                allowNull: false
        },
        googleappid: {
            type: DataTypes.STRING(255),
                allowNull: false
        },
        message: {
            type: DataTypes.STRING(128),
                allowNull: false
        },
        action: {
            type: DataTypes.STRING(64),
                allowNull: false
        },
        title: {
            type: DataTypes.STRING(64),
                allowNull: false
        },
        createdAt: {type: DataTypes.DATE},
        updatedAt: {type: DataTypes.DATE}
    }, {
        tableName: 'notifications',
        associate: function(models) {
            notifications.belongsTo(models.settings, {foreignKey: 'company_id'});
        }

    });
    return notifications;
};
