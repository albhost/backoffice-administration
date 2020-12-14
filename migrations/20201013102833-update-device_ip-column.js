'use strict';
const winston = require('winston');

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.changeColumn('devices', 'device_ip', {
      type: Sequelize.STRING(24),
      allowNull: true
    })
      .catch(function (err) {
        winston.error('Changing devices.device_ip length from 15 to 24 failed with error message: ', err.message);
      });
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.changeColumn('devices', 'device_ip', {
      type: Sequelize.STRING(24),
      allowNull: true
    })
      .catch(function (err) {
        winston.error('Changing devices.device_ip length from 24 to 15 failed with error message: ', err.message);
      });
  }
};