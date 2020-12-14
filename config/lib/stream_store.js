'use strict'

var path = require('path'),
    models = require(path.resolve('./config/lib/sequelize')).models,
    redisClient = require(path.resolve('./config/lib/redis')).client;

const arrayDelimiter = '<>';
const metadataDelimiter = ':';

function loadAllChannelStreams() {
    return models.channels.findAll({
        attributes: ['id', 'company_id']
    }).then(function(channels) {
        let promiseArr = [];
        channels.forEach(element => {
            promiseArr.push(loadChannelStreamsToRedis(element.company_id, element.id));
        });

        return Promise.all(promiseArr);
    });
}

function loadChannelStreamsToRedis(companyId, channelId, clearOnEmpty) {
    return new Promise(function(resolve, reject) {
        models.channel_stream.findAll({
            attributes: ['id', 'channel_id', 'stream_source_id', 'stream_url', 'stream_mode', 'stream_resolution', 'token', 'token_provider', 'is_octoshape', 'thumbnail_url'],
            where: {channel_id: channelId}
        }).then(function(streams) {
            let redisKey = companyId + ':channels:' + channelId + ':streams';
            if (streams.length == 0) {
                if (clearOnEmpty) {
                    redisClient.del(redisKey, function(err) {
                        if (err) {
                            reject({code:500, message: 'Clearing streams in redis failed'});
                        }
                        else {
                            resolve();
                        }
                    })
                    return;
                }
                resolve();
                return;
            }

            let channelStreams = '';
        
            for (let i = 0; i < streams.length; i++) {
                let stream = streams[i];
                let streamMetadata = stream.stream_source_id + metadataDelimiter + stream.stream_mode + metadataDelimiter + stream.stream_resolution;
                let row = streamMetadata + '-' + JSON.stringify(stream);
                if (i < stream.length - 1) {
                    row += arrayDelimiter;
                }

                channelStreams += row;
            }

            redisClient.set(redisKey, channelStreams, function(err) {
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            });

        }).catch(function(err) {
            reject(err);
        });
    });
}

function getChannelStreams(companyId, channelId, sourceId, streamMode, resolution) {
    return new Promise(function(resolve, reject) {
        let redisKey = companyId + ':channels:' + channelId + ':streams';
        redisClient.get(redisKey, function(err, streamRawArray) {
            if (err) {
                reject(err);
                return;
            }

            if (!streamRawArray) {
                reject({code:400, message: 'Channel has no streams loaded in memory'});
                return;
            }

            let streamRows = streamRawArray.split(arrayDelimiter);
            for (let i = 0; i < streamRows.length; i++) {
                let streamRaw = streamRows[i];
                let metaAndStreamArr = streamRaw.split('-');
                let metadata = metaAndStreamArr[0].split(metadataDelimiter);
                if (metadata[0] == sourceId.toString() && metadata[1] == streamMode && metadata[2].indexOf(resolution.toString()) !== -1) {
                    let stream = JSON.parse(metaAndStreamArr[1]);
                    resolve(stream);
                    return;
                }
            }
            reject({code:400, message: 'Channel has no streams loaded in memory'});
        });
    });
}

module.exports = {
    loadChannelStreamsToRedis,
    loadAllChannelStreams,
    getChannelStreams
}
