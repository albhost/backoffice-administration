'use strict';

var winston = require('winston');

module.exports = {
    up: async (queryInterface, Sequelize) => {
        try {
            await queryInterface.addColumn('channel_stream', 'thumbnail_url', {
                type: Sequelize.STRING(255),
                allowNull: true,
                after: 'vmx_asset_id'
            });

            await queryInterface.addColumn('vod_stream', 'thumbnail_url', {
                type: Sequelize.STRING(255),
                allowNull: true,
                after: 'token_url'
            });

        }
        catch(err) {
            winston.error(err);
        }
    },

    down: async (queryInterface, Sequelize) => {

        await queryInterface.removeColumn('channel_stream', 'thumbnail_url');

        await queryInterface.removeColumn('vod_stream', 'thumbnail_url');
    }
};
