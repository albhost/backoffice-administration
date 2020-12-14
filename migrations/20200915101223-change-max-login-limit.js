'use strict';

module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.sequelize.query("alter table login_data alter column max_login_limit set default 1;")
    },

    down: (queryInterface, Sequelize) => {
        return queryInterface.sequelize.query("alter table login_data alter column max_login_limit set default 2;")
    }
};