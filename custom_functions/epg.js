'use strict'

const winston = require("winston");
const { models, sequelize } = require("../config/lib/sequelize");
const redis = require('../config/lib/redis').client;
const { Op } = require('sequelize');

async function getOsdEpg(channelNumber, companyId, assetUrl) {
    let cacheKey = companyId + ':epgCache:' + channelNumber;
    let intervalStart = new Date(Date.now()); //get current time to compare with enddate
    let intervalEnd = new Date(Date.now())
    intervalEnd.setHours(intervalEnd.getHours() + 12);

    try {
        let cacheEntry = await getEpgForOsdFromCache(cacheKey);
        if (cacheEntry) {
            let result = {
                channel: cacheEntry.channel,
                epgs: cacheEntry.epgs,
                intervalStart,
                intervalEnd
            };

            return result;
        }
    }
    catch (err) {
        winston.error('Getting epg from cache failed with error:', err);
    }

    try {
        let channel = await models.channels.findOne({
            attributes: ['channel_number', 'title'],
            where: { company_id: companyId, channel_number: channelNumber }
        });

        if (!channel) {
            throw { code: 404, message: 'Channel not found' }
        }

        try {
            let epgs = await models.epg_data.findAll({
                attributes: ['id', 'title', 'short_description', 'short_name', 'duration_seconds', 'program_start', 'program_end', 'long_description',
                [sequelize.literal('(SELECT IFNULL((SELECT CONCAT("' + assetUrl + '", icon_url) FROM program_content WHERE program_content.title=epg_data.title AND' +
                    ' program_content.channel_id=epg_data.channels_id), "") AS "icon_url")'), 'icon_url']],
                where: {
                    company_id: companyId,
                    program_start: {
                        [Op.lte]: intervalEnd
                    },
                    program_end: {
                        [Op.and]: [
                            { [Op.lte]: intervalEnd },
                            { [Op.gte]: intervalStart }
                        ]
                    }
                },
                order: [['program_start', 'ASC']],
                limit: 2,
                include: [
                    {
                        model: models.channels, required: true, attributes: ['title', 'channel_number'],
                        where: { channel_number: channelNumber } //limit data only for this channel
                    }
                ],
            });

            try {
                await cacheEpgForOSD(cacheKey, channel, epgs);
            } catch (err) {
                winston.error("Caching epg data failed with error:", err)
            }

            let result = {
                channel: channel,
                epgs: epgs,
                intervalStart,
                intervalEnd
            };

            return result;
        } catch (err) {
            winston.error("Getting the list of epgs failed with error: ", err);
            throw err;
        }
    } catch (err) {
        winston.error("Getting the list of channels failed with error: ", err);
        throw err;
    }
}

function getEpgForOsdFromCache(key) {
    return new Promise(function (resolve, reject) {
        redis.get(key, function (err, rawCacheEntry) {
            if (err) {
                reject(err);
                return;
            }

            if (!rawCacheEntry) {
                resolve(undefined);
                return;
            }

            let cacheEntry = JSON.parse(rawCacheEntry);
            resolve(cacheEntry);
        });
    });
}

function cacheEpgForOSD(key, channel, epgs) {
    return new Promise(function (resolve, reject) {
        let expire;

        if (epgs.length > 0) {
            expire = Math.round((epgs[0].program_end.getTime() - Date.now()) / 1000);
        } else {
            expire = 300;
        }

        //Check for dummy epg where date is 1970
        if (expire < 0) {
            //no cache should be done
            reject('Cachinng with an expire date that has passed.');
            return;
        }

        let cacheEntry = {
            channel,
            epgs,
        }

        redis.set(key, JSON.stringify(cacheEntry), function (err) {
            if (err) {
                reject(err);
                return;
            }

            redis.expire(key, expire, function (err) {
                if (err) {
                    reject(err);
                    return;
                }

                resolve();
            });
        });
    });
}

module.exports = {
    getOsdEpg
}