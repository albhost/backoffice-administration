'use strict';

const winston = require("winston");

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.createTable('device_mediaplayer', {
        device_id: {
          type: Sequelize.INTEGER(11),
          allowNull: false,
          primaryKey: true,
          references: {
            model: 'devices',
            key: 'id'
          },
          onUpdate: 'cascade',
          onDelete: 'cascade'
        },
        mediaplayer_id: {
          type: Sequelize.INTEGER(11),
          allowNull: false,
          primaryKey: true,
          references: {
            model: 'media_player',
            key: 'id'
          },
          onUpdate: 'cascade',
          onDelete: 'cascade'
        }
      }, { timestamps: false });
      await queryInterface.sequelize.query('ALTER TABLE device_mediaplayer ADD UNIQUE(device_id)');
    } catch (error) {
      winston.error('Error creating the table device_mediaplayer: ', error);
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.dropTable('device_mediaplayer');
    } catch (error) {
      winston.error('Error during drop of the table device_mediaplayer: ', error);
    }
  }
};
