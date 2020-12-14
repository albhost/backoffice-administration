'use strict';
const path = require('path');
const winston = require('winston');

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('stream_server', {
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
      server_address: {
        type: Sequelize.STRING(500),
        allowNull: false
      },
      api_key: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      client_key: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      base_url: {
        type: Sequelize.STRING(500),
        allowNull: false
      },
      connections_threshold: {
        type: Sequelize.INTEGER(11),
        allowNull: false
      },
      out_rate_threshold: {
        type: Sequelize.INTEGER(11),
        allowNull: false
      },
      server_status_info: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      is_available: {
        type: Sequelize.BOOLEAN,
        allowNull: false
      },
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE,
    }).catch(function (err) {
        winston.error('Creating table stream_server failed with error message: ', err.message);
      })
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('stream_server')
      .catch(function (err) {
        winston.error('Deleting table stream_server failed with error message: ', err.message);
      });
  }
};
