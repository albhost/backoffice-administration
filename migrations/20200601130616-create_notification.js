'use strict';
var winston = require('winston');

module.exports = {
    up: function (queryInterface, DataTypes) {
        return queryInterface.createTable(
            'notifications',
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

            }).catch(function(err) {winston.error('Creating table notification failed with error message: ',err.message);});
    },

    down: function (queryInterface, Sequelize) {
        return queryInterface.dropTable ('notifications')
            .catch(function(err) {winston.error('Deleting table notification failed with error message: ',err.message);});
    }
};