'use strict';

var path = require('path'),
    migrator = require(path.resolve('./custom_functions/advanced_settings_migrator.js')),
    winston = require('winston');

module.exports = {
  up: (queryInterface, Sequelize) => {
    return migrator.migrate(queryInterface, {
      operation: 'add',
      path: '.',
      name: "client_app",
      value: {
        "description": "Configuration for client apps",
        "min_app_allowed": "*",
        "blacklist": []
      }
    }).catch(function(err) {
      winston.error(err);
    });
  },

  down: (queryInterface, Sequelize) => {
    return migrator.migrate(queryInterface, {
      operation: 'remove',
      path: '.',
      name: "client_app",
    });
  }
};
