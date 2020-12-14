'use strict';

const winston = require("winston");

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.createTable('media_player', {
        id: {
          type: Sequelize.INTEGER(11),
          allowNull: false,
          primaryKey: true,
          autoIncrement: true,
          unique: true
        },
        company_id: {
          type: Sequelize.INTEGER(11),
          allowNull: false,
          references: {
            model: 'settings',
            key: 'id'
          }
        },
        player_name: {
          type: Sequelize.STRING(100),
          allowNull: false
        },
        default: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        app_id: {
          type: Sequelize.INTEGER(11),
          allowNull: false,
          references: {
            model: 'app_group',
            key: 'id'
          }
        },
        createdAt: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.fn('now')
        },
        updatedAt: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.fn('now')
        }
      });

      // add default players for each company and each platform
      let companies = await queryInterface.sequelize.query('SELECT id FROM settings');
      let platforms = await queryInterface.sequelize.query('SELECT app_id FROM app_group');

      console.info('Inserting default media players, please wait...');
      for (const company of companies[0]) {
        for (const platform of platforms[0]) {
          await queryInterface.sequelize.query(`INSERT INTO media_player
            (company_id, player_name, \`default\`, app_id)
            VALUES(${company.id}, 'default', 1, ${platform.app_id})`);
        }
      }
    } catch (error) {
      winston.error('Error creating the table media_player: ', error);
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.dropTable('media_player');
    } catch (error) {
      winston.error('Error deleting the table media_player: ', error);
    }
  }
};
