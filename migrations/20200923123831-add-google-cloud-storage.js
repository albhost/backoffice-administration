'use strict';

const path = require('path'),
    migrator = require(path.resolve('./custom_functions/advanced_settings_migrator.js')),
    winston = require("winston");

module.exports = {
    up: (queryInterface, Sequelize) => {
        return migrator.migrate(queryInterface, {
            operation: 'add',
            path: '.',
            name: "google_cloud",
            value: {
                "description": "Integration configuration for storing data to Google Cloud Storage. By default images are saved locally.",
                "storage": false,
                "google_managed_key": "",
                "projectId": "",
                "bucket_name": ""
            }
        }).catch(err => {
            winston.error("Error at adding google cloud storage ", err);
        });
    },

    down: (queryInterface, Sequelize) => {
        return migrator.migrate(queryInterface, {
            operation: 'remove',
            path: '.',
            name: "google_cloud",
        }).catch(err => {
            winston.error("Error at removing google cloud storage", err);
        });
    }
};
