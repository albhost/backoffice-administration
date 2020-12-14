'use strict';
var winston = require('winston');

module.exports = {
    up: function (queryInterface, Sequelize) {
        return queryInterface.removeColumn('carousels', 'description').then(function (success) {
            return queryInterface.removeColumn('carousels', 'message')
                .catch(function (err) {
                    winston.error('Dropping column carousels.message failed with error message: ', err.message);
                });
        }).catch(function (err) {
            winston.error('Dropping column carousels.description failed with error message: ', err.message);
        });
    },


    down: function (queryInterface, Sequelize) {
        return queryInterface.addColumn('carousels', 'description', {
            type: Sequelize.STRING,
            allowNull: true
        }).then(function (success) {
            return queryInterface.addColumn('carousels', 'message', {
                type: Sequelize.STRING,
                allowNull: true
            })
                .catch(function (err) {
                    winston.error('Adding column carousels.message failed with error message: ', err.message);
                });
        }).catch(function (err) {
            winston.error('Adding column carousels.description failed with error message: ', err.message);
        });
    }
};