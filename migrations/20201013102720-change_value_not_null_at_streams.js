'use strict';

var winston = require('winston');

module.exports = {
    up: (queryInterface, Sequelize) => {
        return Promise.all([
            queryInterface.sequelize.query('ALTER TABLE vod_stream MODIFY COLUMN encryption BOOLEAN NULL')
                .catch(function(err){winston.error(err)}),
            queryInterface.sequelize.query('ALTER TABLE channel_stream MODIFY COLUMN encryption BOOLEAN NULL')
                .catch(function(err){winston.error(err)})
        ])
    },

    down: (queryInterface, Sequelize) => {
        return queryInterface.sequelize.transaction(function(t) {
            return queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS=0', {transaction: t})
                .then(function() {
                    return Promise.all([
                        queryInterface.sequelize.query("ALTER TABLE vod_stream MODIFY COLUMN encryption BOOLEAN NULL ")
                            .catch(function() {}),
                        queryInterface.sequelize.query("ALTER TABLE channel_stream MODIFY COLUMN encryption BOOLEAN NULL ")
                            .catch(function(err) {})
                    ]);
                })
        })
            .then(function() {
                queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS=1')
            })
            .catch(function(err) {winston.error(err)})
    }
};
