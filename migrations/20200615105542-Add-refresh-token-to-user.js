'use strict';
const {v4: uuid} = require('uuid');
const winston = require("winston");

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('login_data', 'refresh_token_secret', {
      type: Sequelize.UUID,
      allowNull: true,
      defaultValue: uuid(),
      after: 'resetPasswordExpires'
    }).catch(function (err) {
      winston.error('Adding column login_data.refresh_token_secret failed with error message: ', err.message);
    }).then(() => {
      return queryInterface.sequelize.query(`UPDATE login_data set refresh_token_secret = LOWER(CONCAT(
      LPAD(HEX(FLOOR(RAND() * 0xffff)), 4, '0'),
      LPAD(HEX(FLOOR(RAND() * 0xffff)), 4, '0'), '-',
      LPAD(HEX(FLOOR(RAND() * 0xffff)), 4, '0'), '-',
      '4',
      LPAD(HEX(FLOOR(RAND() * 0x0fff)), 3, '0'), '-',
      HEX(FLOOR(RAND() * 4 + 8)),
      LPAD(HEX(FLOOR(RAND() * 0x0fff)), 3, '0'), '-',
      LPAD(HEX(FLOOR(RAND() * 0xffff)), 4, '0'),
      LPAD(HEX(FLOOR(RAND() * 0xffff)), 4, '0'),
      LPAD(HEX(FLOOR(RAND() * 0xffff)), 4, '0')));`).catch(function (err) {
        winston.error('Adding column 2 login_data.refresh_token_secret failed with error message: ', err.message);
      })
    })
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn("login_data", "refresh_token_secret").catch(function (err) {
      winston.error('Dropping column login_data.refresh_token_secret failed with error message: ', err.message);
    });
  }
};
