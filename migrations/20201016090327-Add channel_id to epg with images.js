'use strict';

const winston = require('winston');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.addColumn('program_content', 'channel_id', {
        type: Sequelize.STRING(255),
        allowNull: false
      });
    } catch (err) {
      winston.error(err);
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.removeColumn('program_content', 'channel_id');
    } catch (e) {
      winston.error(e);
    }
  }
};
