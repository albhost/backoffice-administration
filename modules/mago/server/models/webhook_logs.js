"use strict";

module.exports = function(sequelize, DataTypes) {
    var Webhook_logs = sequelize.define('webhook_logs', {
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
        user_id: {
            type: DataTypes.INTEGER(11),
            allowNull: false
        },
        action: {
            type: DataTypes.STRING(10),
            allowNull: false

        },
        details: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        createdAt: {type: DataTypes.DATE},
        updatedAt: {type: DataTypes.DATE}
    }, {
        tableName: 'webhook_logs',
        associate: function(models) {
            if(models.users){
                Webhook_logs.belongsTo(models.users, {foreignKey: 'user_id'})
            }
            Webhook_logs.belongsTo(models.settings, {foreignKey: 'company_id'});
        }
    });
    return Webhook_logs;
};
