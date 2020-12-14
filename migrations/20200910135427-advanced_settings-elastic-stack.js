'use strict';

const path = require('path'),
    migrator = require(path.resolve('./custom_functions/advanced_settings_migrator.js')),
    winston = require("winston");

module.exports = {
    up: (queryInterface, Sequelize) => {
        return migrator.migrate(queryInterface, {
            operation: 'add',
            path: '.',
            name: "elastic_stack",
            value: {
                "description": "Integration configuration for Elastic Stack. Parameters username and password are credentials of your account at Elastic Stack.",
                "url": "",
                "username": "",
                "password": ""
            }
        }).catch(err => {
            winston.error("Error at adding elastic stack ", err);
        });
    },

    down: (queryInterface, Sequelize) => {
        return migrator.migrate(queryInterface, {
            operation: 'remove',
            path: '.',
            name: "elastic_stack",
        }).catch(err => {
            winston.error("Error at removing elastic stack ", err);
        });
    }
};
