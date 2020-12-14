'use strict';
var winston = require('winston');

module.exports = {
    up: function (queryInterface, DataTypes) {
        return queryInterface.createTable(
            'webhook_logs',
            {
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

            }).catch(function(err) {winston.error('Creating table webhook_logs failed with error message: ',err.message);});
    },

    down: function (queryInterface, Sequelize) {
        return queryInterface.dropTable ('webhook_logs')
            .catch(function(err) {winston.error('Deleting table webhook_logs failed with error message: ',err.message);});
    }
};