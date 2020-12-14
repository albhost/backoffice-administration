'use strict';
const path = require('path');
const winston = require('winston');
const carousels = require(path.resolve('./config/defaultvalues/carousels.json'));

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('carousels', {
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
        defaultValue: 1,
        references: {
          model: 'settings',
          key: 'id'
        }
      },
      type: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      title: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      description: {
        type: Sequelize.STRING(1000),
        allowNull: true
      },
      is_available: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      message: {
        type: Sequelize.STRING(200),
        allowNull: true
      },
      order_number: {
        type: Sequelize.INTEGER(2),
        allowNull: false
      },
      createdAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now')
      },
      updatedAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now')
      }
    })
      .then(async () => {
        for (const [index, carousel] of carousels.entries()) {
          await queryInterface.sequelize.query(`
            INSERT INTO carousels (type, title, order_number) VALUES ('${carousel.type}', '${carousel.title}', ${index + 1});
          `)
        }
      })
      .catch(function (err) {
        winston.error('Creating table carousels failed with error message: ', err.message);
      })
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('carousels')
      .catch(function (err) {
        winston.error('Deleting table carousels failed with error message: ', err.message);
      });
  }
};
