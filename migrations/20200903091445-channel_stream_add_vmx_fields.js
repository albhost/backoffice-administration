'use strict';

var winston = require('winston');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.addColumn('channel_stream', 'vmx_content_id', {
        type: Sequelize.STRING(50), 
        defaultValue: '', 
        after: 'is_octoshape'
      });

      await queryInterface.addColumn('channel_stream', 'vmx_asset_id', {
        type: Sequelize.STRING(50), 
        defaultValue: '',
        after: 'vmx_content_id' 
      });
    } 
    catch(err) {
      winston.error(err);
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('channel_stream', 'vmx_content_id');

    await queryInterface.removeColumn('channel_stream', 'vmx_asset_id');
  }
};
