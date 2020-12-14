'use strict';
var winston = require('winston');

module.exports = {
    up: function (queryInterface, Sequelize) {
        return queryInterface.addColumn('settings', 'terms_condition_page',{type: Sequelize.STRING(255), defaultValue: '', allowNull: false})
            .catch(function(err) {winston.error('Adding column settings.terms_condition_page failed with error message: ',err.message);});
    },

    down: function (queryInterface, Sequelize) {
        return queryInterface.removeColumn('settings', 'terms_condition_page')
            .catch(function(err) {winston.error('Removing column settings.terms_condition_page failed with error message: ',err.message);});
    }
};