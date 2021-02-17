'use strict';

const winston = require("winston");

module.exports = {
  up: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn('vod_menu', 'is_adult', {
        type: Sequelize.BOOLEAN,
        allowNull: true,
        defaultValue: false
      }).catch(function (err) {
        winston.error(err);
      }),
      queryInterface.addColumn('genre', 'is_adult', {
        type: Sequelize.BOOLEAN,
        allowNull: true,
        defaultValue: false
      }).catch(function (err) {
        winston.error(err);
      })
    ])
  },

  down: (queryInterface, Sequelize) => {
   return Promise.all([
     queryInterface.removeColumn('vod_menu','is_adult'),
     queryInterface.removeColumn('genre','is_adult'),
   ])
  }
};
