'use strict';

var path = require('path'),
    migrator = require(path.resolve('./custom_functions/advanced_settings_migrator.js')),
    winston = require('winston');

module.exports = {
  up: (queryInterface, Sequelize) => {
    return migrator.migrate(queryInterface, {
      operation: 'add',
      path: '.',
      name: "public_api",
      value:  {
        "auth": {
            "ip_whitelist": []
        }
      }
    }).catch(function(err) {
      winston.error(err);
    });
  },

  down: (queryInterface, Sequelize) => {
    return migrator.migrate(queryInterface, {
      operation: 'remove',
      path: '.',
      name: "public_api",
    });
  }
};
