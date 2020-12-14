'use strict';

var winston = require('winston');
module.exports = {
    up: (queryInterface, Sequelize) => {
                return queryInterface.sequelize.query("ALTER TABLE tv_series_resume ADD UNIQUE(tv_series_id, login_id)")
                    .catch(function (error) {
                        winston.error(error)
                    })
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.sequelize.transaction(function(t) {
            return queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS=0', {transaction: t})
                .then(function() {
                    return Promise.all([
                        queryInterface.sequelize.query("ALTER TABLE vod_resume ADD UNIQUE(vod_id, login_id)")
                            .catch(function(err) {winston.error(err)})
                    ]);
                })
        })
            .then(function() {
                queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS=1')
            })
            .catch(function(err) {winston.error(err)})
    }
};