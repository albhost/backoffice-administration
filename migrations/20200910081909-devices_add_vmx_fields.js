'use strict';

var winston = require('winston');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.addColumn('devices', 'vmx_id', {
        type: Sequelize.STRING(255), 
        allowNull: true,
        after: 'language'
      });

      await queryInterface.addColumn('devices', 'vmx_player_id', {
        type: Sequelize.STRING(255), 
        allowNull: true,
        after: 'vmx_id'
      });

      await queryInterface.addColumn('devices', 'vmx_subscription_id', {
        type: Sequelize.STRING(255), 
        allowNull: true,
        after: 'vmx_player_id'
      });

      await queryInterface.addColumn('devices', 'vmx_subscription_end', {
        type: Sequelize.DATE, 
        allowNull: true,
        after: 'vmx_subscription_id'
      });
    }
    catch(err) {
      winston.error(err);
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('devices', 'vmx_id');

    await queryInterface.removeColumn('devices', 'vmx_player_id');

    await queryInterface.removeColumn('devices', 'vmx_subscription_id');

    await queryInterface.removeColumn('devices', 'vmx_subscription_end');
  }
};
