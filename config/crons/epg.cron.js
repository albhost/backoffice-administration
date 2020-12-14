'use strict'

const {Op} = require('sequelize');
const {models} = require('../lib/sequelize');
const winston = require('winston');

module.exports = {
    name: 'delete-old-epg',
    cronExp: '0 0 0 * * *',
    routine: async () =>  {
        //Destroy all epg records older than 2 weks
        let date = new Date();
        date.setDate(date.getDate() - 14);

        try {
            winston.info('Deleting epg that is older than ', date);
            await models.epg_data.destroy({
                where: {
                    program_start: {
                        [Op.lte]: date
                    }
                }
            });
        }
        catch(err) {
            winston.error('Deleting epg failed');
        }
    }
}