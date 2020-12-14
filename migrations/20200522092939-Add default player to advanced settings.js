'use strict';

const path = require('path'),
  migrator = require(path.resolve('./custom_functions/advanced_settings_migrator.js')),
  winston = require("winston");

module.exports = {
  up: (queryInterface, Sequelize) => {
    return migrator.migrate(queryInterface, {
      operation: 'add',
      path: '.',
      name: "default_player",
      value: {
        "description": "Default Player for android when new customer is created.",
        "value": "default"
      }
    }).catch(err => {
      winston.error("Error at adding default player ", err);
    });
  },

  down: (queryInterface, Sequelize) => {
    return migrator.migrate(queryInterface, {
      operation: 'remove',
      path: '.',
      name: "default_player",
    }).catch(err => {
      winston.error("Error at removing default player ", err);
    });
  }
};
