'use strict';
var winston = require('winston');

module.exports = {
    up: function (queryInterface, Sequelize) {
        return queryInterface.addColumn('login_data', 'verified', {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: true,
            after: 'account_lock'
        }).catch(function (err) {
            winston.error('Adding column login_data.verified failed with error message: ', err.message);
        });
    },
    down: function (queryInterface, Sequelize) {
        return queryInterface.removeColumn('login_data', 'verified').catch(function (err) {
            winston.error('Dropping column login_data.verified failed with error message: ', err.message);
        });
    }
};