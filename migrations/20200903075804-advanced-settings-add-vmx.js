'use strict';

var path = require('path'),
    migrator = require(path.resolve('./custom_functions/advanced_settings_migrator.js')),
    winston = require('winston');

module.exports = {
  up: (queryInterface, Sequelize) => {
    return migrator.migrate(queryInterface, {
      operation: 'add',
      path: '.',
      name: "vmx",
      value:  {
        "description": "VMX configuration",
        "tenant_id":  0,
        "company_name": "",
        "username": "",
        "password": ""
      }
    }).catch(function(err) {
      winston.error(err);
    });
  },

  down: (queryInterface, Sequelize) => {
    return migrator.migrate(queryInterface, {
      operation: 'remove',
      path: '.',
      name: "vmx",
    });
  }
};
