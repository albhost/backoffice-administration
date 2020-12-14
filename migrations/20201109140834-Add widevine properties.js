'use strict';

const path = require('path'),
  migrator = require(path.resolve('./custom_functions/advanced_settings_migrator.js')),
  winston = require("winston");

module.exports = {
  up: (queryInterface, Sequelize) => {
    return migrator.migrate(queryInterface, {
      operation: 'add',
      path: '.',
      name: "widevine",
      value: {
        "description": "Integration configuration for widevine keys.",
        "key": "",
        "iv": "",
        "provider": "",
        "license_content_key": ""
      }
    }).catch(err => {
      winston.error("Error at adding widevine configurations", err);
    });
  },

  down: (queryInterface, Sequelize) => {
    return migrator.migrate(queryInterface, {
      operation: 'remove',
      path: '.',
      name: "widevine",
    }).catch(err => {
      winston.error("Error at removing widevine configurations", err);
    });
  }
};
