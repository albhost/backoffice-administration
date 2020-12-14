'use strict';
var winston = require('winston');

module.exports = {
    up: function (queryInterface, Sequelize) {
        return queryInterface.createTable('carousel_channels', {
            id: {
                type: Sequelize.INTEGER(11),
                allowNull: false,
                primaryKey: true,
                autoIncrement: true,
                unique: true
            },
            carousel_type: {
                type: Sequelize.STRING(128),
                allowNull: false
            },
            company_id: {
                type: Sequelize.INTEGER(11),
                allowNull: false
            },
            channel_id: {
                    type: Sequelize.TEXT,
                    allowNull: true,
                },
            createdAt: {
                type: Sequelize.DATE
            },
            updatedAt: {
                type: Sequelize.DATE
            }

        }).catch(function(err) {winston.error('Creating new table carousel_channels failed with error message: ',err.message);});
    },

    down: function (queryInterface, Sequelize) {
        return queryInterface.dropTable('vod_menu')
            .catch(function(err) {winston.error('Deleting the table carousel_channels failed with error message: ',err.message);});
    }

};
