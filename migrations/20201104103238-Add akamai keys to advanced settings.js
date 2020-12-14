'use strict';

const path = require('path'),
  migrator = require(path.resolve('./custom_functions/advanced_settings_migrator.js')),
  winston = require("winston");

module.exports = {
  up: (queryInterface, Sequelize) => {
    return migrator.migrate(queryInterface, {
      operation: 'add',
      path: '.',
      name: "akamai_segment_media",
      value: {
        "description": "Integration configuration for akamai segment media token.",
        "key": "",
        "window": "",
        "salt": "",
      }
    }).catch(err => {
      winston.error("Error at adding akamai_segment_media ", err);
    });
  },

  down: (queryInterface, Sequelize) => {
    return migrator.migrate(queryInterface, {
      operation: 'remove',
      path: '.',
      name: "akamai_segment_media",
    }).catch(err => {
      winston.error("Error at removing akamai_segment_media", err);
    });
  }
};
