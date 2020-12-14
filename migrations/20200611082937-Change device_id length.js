'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.query("alter table devices modify device_id varchar(255) not null;")
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.query("alter table devices modify device_id varchar(40) not null;")
  }
};
