'use strict';
var path = require('path'),
    db = require(path.resolve('./config/lib/sequelize')),
    Sequelize = require('sequelize'),
    response = require(path.resolve("./config/responses.js")),
    winston = require(path.resolve('./config/lib/winston')),
    async = require('async'),
    schedule = require('../../../../config/lib/scheduler'),
    models = db.models;
    const  { Op } = require('sequelize');

//RETURNS LIST OF CHANNELS AVAILABLE TO THE USER FOR THIS DEVICE

/**
 * @apiDefine body_auth
 * @apiSuccess {string} auth The authentication token of user.
 */

/**
 * @api {POST} /apiv2/channels/list Channels - Livetv and personal channel list
 * @apiName channel_list
 * @apiGroup DeviceAPI
 *
 * @apiUse body_auth
 *
 * @apiParam {String} auth Encrypted string composed of username, password, appid, boxid and timestamp.
 *
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "status_code": 200,
 *       "error_code": 1,
 *       "timestamp": 1517479302000, //unix timestamp in milliseconds
 *       "error_description": 'OK',
 *       "extra_data": '',
 *       "response_object": [
 *       {
 *          "id": 1,
 *          "channel_number": 100,
 *          "title": "title",
 *          "icon_url": "http://.../image.png",
 *          "stream_url": "stream url",
 *          "drm_platform": "drm_platform",
 *          "genre_id": 1,
 *          "channel_mode": "live",
 *          "pin_protected": "false", //"true" / "false" values
 *          "stream_source_id": 1,
 *          "stream_format": "0", //current values include 0 (mpd), 1 (smooth streaming), 2 (hls), 3 (other)
 *          "token": 1, // values 0 / 1
 *          "token_url": "token url",
 *          "encryption": 0, // values 0 / 1
 *          "encryption_url": "encryption url",
 *          "is_octoshape": 0, // values 0 / 1
 *          "favorite_channel": "0" // values "0" / "1"
 *       }, ....
 *       ]
 *   }
 *
 * @apiDescription Returns catchup stream url for the requested channel.
 *
 * Copy paste this auth for testing purposes
 *auth=gPIfKkbN63B8ZkBWj+AjRNTfyLAsjpRdRU7JbdUUeBlk5Dw8DIJOoD+DGTDXBXaFji60z3ao66Qi6iDpGxAz0uyvIj/Lwjxw2Aq7J0w4C9hgXM9pSHD4UF7cQoKgJI/D
 *
 */
exports.list = function(req, res) {
    var qwhere = {};
    //qwhere.isavailable = true;
    if(req.thisuser.show_adult == 0) qwhere.pin_protected = 0; //show adults filter
    else qwhere.pin_protected != ''; //avoid adult filter
    qwhere.isavailable = 1;
    qwhere.company_id = req.thisuser.company_id;

    // requisites for streams provided by the user
    var userstream_qwhere = {"isavailable": true, "login_id": req.thisuser.id};

    // requisites for streams served by the company
    var stream_qwhere = {};
    stream_qwhere.stream_source_id = req.thisuser.channel_stream_source_id; // streams come from the user's stream source
    stream_qwhere.stream_mode = 'live'; //filter streams based on device resolution
    stream_qwhere.stream_resolution = {[Op.like]: "%"+req.auth_obj.appid+"%"};

    //find user channels and subscription channels for the user
    models.channels.findAll({
        raw:true,
        attributes: ['id','genre_id', 'channel_number', 'title', 'icon_url','pin_protected', 'catchup_mode'],
        group: ['id'],
        where: qwhere,
        include: [
            {model: models.channel_stream,
                required: true,
                attributes: ['stream_source_id','stream_url','stream_format', 'drm_platform', 'token','token_url','is_octoshape','encryption','encryption_url', 'thumbnail_url'],
                where: stream_qwhere
            },
            { model: models.genre, required: true, attributes: [], where: {is_available: true} },
            {model: models.packages_channels,
                required: true,
                attributes:[],
                include:[
                    {model: models.package,
                        required: true,
                        attributes: [],
                        where: {package_type_id: req.auth_obj.screensize},
                        include:[
                            {model: models.subscription,
                                required: true,
                                attributes: [],
                                where: {login_id: req.thisuser.id, end_date: {[Op.gte]: Date.now()}}
                            }
                        ]}
                ]},
            {model: models.favorite_channels,
                required: false, //left join
                attributes: ['id'],
                where: {user_id: req.thisuser.id}
            }
        ],
        order: [[ 'channel_number', 'ASC' ]]
    }).then(function (result) {
        for (var i = 0; i < result.length; i++) {
            result[i].icon_url = req.app.locals.backendsettings[req.thisuser.company_id].assets_url + result[i]["icon_url"];
            result[i].pin_protected = result[i].pin_protected == 0 ? 'false':'true';
            result[i].stream_source_id = result[i]["channel_streams.stream_source_id"]; delete result[i]["channel_streams.stream_source_id"];
            result[i].stream_url = result[i]["channel_streams.stream_url"]; delete result[i]["channel_streams.stream_url"];
            result[i].channel_mode = set_stream_mode(result[i]);
            result[i].stream_format = result[i]["channel_streams.stream_format"]; delete result[i]["channel_streams.stream_format"];
            result[i].drm_platform = result[i]["channel_streams.drm_platform"]; delete result[i]["channel_streams.drm_platform"];
            result[i].token = result[i]["channel_streams.token"]; delete result[i]["channel_streams.token"];
            result[i].token_url = result[i]["channel_streams.token_url"]; delete result[i]["channel_streams.token_url"];
            result[i].encryption = result[i]["channel_streams.encryption"]; delete result[i]["channel_streams.encryption"];
            result[i].encryption_url = result[i]["channel_streams.encryption_url"]; delete result[i]["channel_streams.encryption_url"];
            result[i].is_octoshape = result[i]["channel_streams.is_octoshape"]; delete result[i]["channel_streams.is_octoshape"];
            result[i].favorite_channel = result[i]["favorite_channels.id"] ? "1":"0"; delete result[i]["favorite_channels.id"];
        }

        //var response_data = result.concat(user_channel_list);
        response.send_res(req, res, result, 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'private,max-age=86400');
    }).catch(function(error) {
        winston.error("Searching for the users list of channels failed with error: ", error);
        response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
    });
};


//RETURNS LIST OF CHANNELS AVAILABLE TO THE USER FOR THIS DEVICE USING GET METHOD
/**
 * @api {GET} /apiv2/channels/list Get LiveTV Channels List
 * @apiName GetChannelsList
 * @apiGroup Channels
 *
 * @apiHeader {String} auth Encrypted string composed of username, password, appid, boxid and timestamp.
 *
 * @apiDescription Copy paste this auth for testing purposes
 *
 * auth=%7Bapi_version%3D22%2C+appversion%3D1.1.4.2%2C+screensize%3D480x800%2C+appid%3D2%2C+devicebrand%3D+SM-G361F+Build%2FLMY48B%2C+language%3Deng%2C+ntype%3D1%2C+app_name%3DMAGOWARE%2C+device_timezone%3D2%2C+os%3DLinux%3B+U%3B+Android+5.1.1%2C+auth%3D8yDhVenHT3Mp0O2QCLJFhCUfT73WR1mE2QRc1ZE7J22cRfmskdTmhCk9ssGWhoIBpIzoTEOLIqwl%0A47NaUwLoLZjH1i2WRYaiioIRMqhRvH2FsSuf1YG%2FFoT9fEw4CrxF%0A%2C+hdmi%3Dfalse%2C+firmwareversion%3DLMY48B.G361FXXU1APB1%7D
 *
 */

exports.list_get = function(req, res) {
    var qwhere = {};
    qwhere.isavailable = true;
    if(req.thisuser.show_adult == 0) qwhere.pin_protected = 0; //show adults filter
    else qwhere.pin_protected != ''; //avoid adult filter
    qwhere.isavailable = 1;
    qwhere.company_id = req.thisuser.company_id;

    // requisites for streams provided by the user
    var userstream_qwhere = {"isavailable": true, "login_id": req.thisuser.id};

    // requisites for streams served by the company
    var stream_qwhere = {};
    stream_qwhere.stream_source_id = req.thisuser.channel_stream_source_id; // streams come from the user's stream source
    stream_qwhere.stream_mode = 'live'; //filter streams based on device resolution
    stream_qwhere.stream_resolution = {[Op.like]: "%"+req.auth_obj.appid+"%"};

    //find user channels and subscription channels for the user
    models.channels.findAll({
        raw:true,
        attributes: ['id','genre_id', 'channel_number', 'title', 'icon_url','pin_protected', 'catchup_mode'],
        group: ['id'],
        where: qwhere,
        include: [
            {model: models.channel_stream,
                required: true,
                attributes: ['stream_source_id','stream_url','stream_format','token','token_url','is_octoshape','drm_platform','encryption','encryption_url','thumbnail_url'],
                where: stream_qwhere
            },
            { model: models.genre, required: true, attributes: [], where: {is_available: true} },
            {model: models.packages_channels,
                required: true,
                attributes:[],
                include:[
                    {model: models.package,
                        required: true,
                        attributes: [],
                        where: {package_type_id: req.auth_obj.screensize},
                        include:[
                            {model: models.subscription,
                                required: true,
                                attributes: [],
                                where: {login_id: req.thisuser.id, end_date: {[Op.gte]: Date.now()}}
                            }
                        ]}
                ]},
            {model: models.favorite_channels,
                required: false, //left join
                attributes: ['id'],
                where: {user_id: req.thisuser.id}
            }
        ],
        order: [[ 'channel_number', 'ASC' ]]
    }).then(function (result) {
        for (var i = 0; i < result.length; i++) {
            result[i].icon_url = req.app.locals.backendsettings[req.thisuser.company_id].assets_url + result[i]["icon_url"];
            result[i].pin_protected = result[i].pin_protected == 0 ? 'false':'true';
            result[i].stream_source_id = result[i]["channel_streams.stream_source_id"]; delete result[i]["channel_streams.stream_source_id"];
            result[i].stream_url = result[i]["channel_streams.stream_url"]; delete result[i]["channel_streams.stream_url"];
            result[i].channel_mode = set_stream_mode(result[i]);
            result[i].stream_format = result[i]["channel_streams.stream_format"]; delete result[i]["channel_streams.stream_format"];
            result[i].token = result[i]["channel_streams.token"]; delete result[i]["channel_streams.token"];
            result[i].token_url = result[i]["channel_streams.token_url"]; delete result[i]["channel_streams.token_url"];
            result[i].encryption = result[i]["channel_streams.encryption"]; delete result[i]["channel_streams.encryption"];
            result[i].encryption_url = result[i]["channel_streams.encryption_url"]; delete result[i]["channel_streams.encryption_url"];
            result[i].thumbnail_url = result[i]["channel_streams.thumbnail_url"]; delete result[i]["channel_streams.thumbnail_url"];
            result[i].drm_platform = result[i]["channel_streams.drm_platform"]; delete result[i]["channel_streams.drm_platform"];
            result[i].is_octoshape = result[i]["channel_streams.is_octoshape"]; delete result[i]["channel_streams.is_octoshape"];
            result[i].favorite_channel = result[i]["favorite_channels.id"] ? "1":"0"; delete result[i]["favorite_channels.id"];
        }

        //var response_data = result.concat(user_channel_list);
        response.send_res_get(req, res, result, 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'private,max-age=86400');

    }).catch(function(error) {
        winston.error("Searching for the users list of channels failed with error: ", error);
        response.send_res_get(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
    });
};


//RETURNS LIST OF LIVE TV GENRES, INCLUDING A STATIC FAVORITE GENRE
/**
 * @api {POST} /apiv2/channels/genre Channels - genre list
 * @apiName livetv_genre_list
 * @apiGroup DeviceAPI
 *
 * @apiParam {String} auth Encrypted string composed of username, password, appid, boxid and timestamp.
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "status_code": 200,
 *       "error_code": 1,
 *       "timestamp": 1517479302000, //unix timestamp in milliseconds
 *       "error_description": 'OK',
 *       "extra_data": 'OK_DATA',
 *       "response_object": [
 *       {
 *          "id": 1,
 *          "name": "genre name"
 *       }, ....
 *       ]
 *   }
 */
exports.genre = function(req, res) {
    models.genre.findAll({
        attributes: ['id',['description', 'name'], [Sequelize.fn('concat', req.app.locals.backendsettings[req.thisuser.company_id].assets_url, Sequelize.col('icon_url')), 'icon'] ],
        where: {is_available: true, company_id: req.thisuser.company_id}
    }).then(function (result) {
        var favorite_genre = {
            "id": 666,
            "name": "Favorites"
        };
        var response_data = result.concat(favorite_genre);
        response.send_res(req, res, response_data, 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'private,max-age=86400');
    }).catch(function(error) {
        winston.error("Getting list of genres failed with error: ", error);
        response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
    });
};


//RETURNS LIST OF LIVE TV GENRES, INCLUDING A STATIC FAVORITE GENRE - GET METHOD
/**
 * @api {POST} /apiv2/channels/genre Channels - genre list
 * @apiName livetv_genre_list
 * @apiGroup DeviceAPI
 *
 * @apiParam {String} auth Encrypted string composed of username, password, appid, boxid and timestamp.
 *
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "status_code": 200,
 *       "error_code": 1,
 *       "timestamp": 1517479302000, //unix timestamp in milliseconds
 *       "error_description": 'OK',
 *       "extra_data": 'OK_DATA',
 *       "response_object": [
 *       {
 *          "id": 1,
 *          "name": "genre name"
 *       }, ....
 *       ]
 *   }
 */
exports.genre_get = function(req, res) {
    let where = {
        is_available: true, company_id: req.thisuser.company_id
    };

    if(req.thisuser.show_adult === false) where.pin_protected = false;

    const showAdult = req.query.show_adult == "false";
    if(showAdult) where.is_adult = false;

    models.genre.findAll({
        attributes: ['id', 'pin_protected','is_adult', ['description', 'name'], [Sequelize.fn('concat', req.app.locals.backendsettings[req.thisuser.company_id].assets_url, Sequelize.col('icon_url')), 'icon'] ],
        where: where
    }).then(function (result) {
        const favorite_genre = {
            id: 666,
            name: "Favorites",
            pin_protected: false
        };
        const response_data = result.concat(favorite_genre);
        response.send_res_get(req, res, response_data, 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'private,max-age=86400');
    }).catch(function(error) {
        winston.error("Getting list of genres failed with error: ", error);
        response.send_res_get(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
    });
};


//API FOR FAVORITE CHANNELS. ADDS OR REMOVES A CHANNEL FROM THE USER FAVORITES LIST
/**
 * @api {POST} /apiv2/channels/current_epgs Channels - favorite channel
 * @apiName livetv_favorite_channel
 * @apiGroup DeviceAPI
 *
 * @apiParam {String} auth Encrypted string composed of username, password, appid, boxid and timestamp.
 * @apiParam {Number} channelNumber Number of the channel to be added / removed from favorites
 * @apiParam {Number} action 0 to remove, 1 to add to favorites
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "status_code": 200,
 *       "error_code": 1,
 *       "timestamp": 1517479302000, //unix timestamp in milliseconds
 *       "error_description": 'OK',
 *       "extra_data": 'informin message', //message informs of the action (add/remove) performed for user and channel
 *       "response_object": []
 *   }
 */
exports.favorites = function(req, res) {
    async.waterfall([
        //GETTING USER DATA
        function(callback) {
            models.login_data.findOne({
                attributes: ['id'],
                where: {username: req.auth_obj.username, company_id: req.thisuser.company_id}
            }).then(function (user) {
                callback(null, user.id);
                return null;
            }).catch(function(error) {
                winston.error("Finding account id failed with error: ", error);
                response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
            });
        },
        function(user_id, callback) {
            models.channels.findOne({
                attributes: ['id'], where: {channel_number: req.body.channelNumber}
            }).then(function (channel) {
                callback(null, user_id, channel.id);
                return null;
            }).catch(function(error) {
                winston.error("Finding channel id failed with error: ", error);
                response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
            });
        },
        function(user_id, channel_id) {
            if(req.body.action == "1"){
                models.favorite_channels.findOrCreate({
                    where: {
                        channel_id: channel_id,
                        user_id: user_id,
                        company_id: req.thisuser.company_id
                    }
                }).then(function ([fav_channel, created]) {
                    if(created === false) {
                        return response.send_res(req, res, [], 409, 1, 'FAVORITE_CHANNEL_ALREADY_EXISTS_AS_FAVORITE', "FAVORITE_CHANNEL_ALREADY_EXISTS_AS_FAVORITE", 'private,max-age=86400');
                    }

                    const extra_data = "Added channel " + req.body.channelNumber + " as a favorite of user " + req.auth_obj.username;
                    response.send_res(req, res, [], 200, 1, 'OK_DESCRIPTION', extra_data, 'private,max-age=86400');
                }).catch(function(error) {
                    winston.error("Saving channel as favorite failed with error: ", error);
                    response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
                });
            }
            else if(req.body.action == "0"){
                models.favorite_channels.destroy({
                    where: {
                        channel_id: channel_id,
                        user_id: user_id
                    }
                }).then(function (result) {
                    const extra_data = "Removed channel "+req.body.channelNumber+" from the list of favorites for user "+req.auth_obj.username; //todo: dynamic response
                    response.send_res(req, res, [], 200, 1, 'OK_DESCRIPTION', extra_data, 'private,max-age=86400');
                }).catch(function(error) {
                    winston.error("Removing channel from favorites failed with error: ", error);
                    response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
                });
            }
        }
    ], function (err) {
        response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
    });
};




//PROVIDES INFORMATION OVER A SINGLE PROGRAM
/**
 * @apiDefine body_auth
 * @apiSuccess {string} auth The authentication token of user.
 */
/**
 * @api {POST} /apiv2/channels/program_info Channels - info on a program
 * @apiName program_info
 * @apiGroup DeviceAPI
 *
 * @apiUse body_auth
 *
 * @apiParam {String} auth Encrypted string composed of username, password, appid, boxid and timestamp.
 * @apiParam {Number} program_id Id  of the program to be scheduled / unscheduled
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "status_code": 200,
 *       "error_code": 1,
 *       "timestamp": 1517479302000, //unix timestamp in milliseconds
 *       "error_description": 'OK',
 *       "extra_data": 'OK_DATA', //message informs of the action (add/remove) performed for user and channel
 *       "response_object": [
 *          "genre": "channel genre",
 *          "program_title": "program title",
 *          "program_description": " program description",
 *          "channel_title": "channel name",
 *          "channel_description": "channel descrption",
 *          "status": "future", // values future for future events, catchup for past events, live for events currently being transmited
 *          "scheduled": true // values true / false,
 *          "has_catchup": true //values true/false
 *       ]
 *   }
 *
 * @apiDescription Returns catchup stream url for the requested channel.
 *
 * Copy paste this auth for testing purposes
 *auth=gPIfKkbN63B8ZkBWj+AjRNTfyLAsjpRdRU7JbdUUeBlk5Dw8DIJOoD+DGTDXBXaFji60z3ao66Qi6iDpGxAz0uyvIj/Lwjxw2Aq7J0w4C9hgXM9pSHD4UF7cQoKgJI/D
 */
exports.program_info = function(req, res) {
    var stream_mode = 'catchup';

    models.epg_data.findOne({
        attributes: ['title', 'long_description', 'program_start', 'program_end'],
        where: {id: req.body.program_id, company_id: req.thisuser.company_id},
        include: [
            {
                model: models.channels, required: true, attributes: ['title', 'description'],
                include: [
                    {model: models.genre, required: true, attributes: [ 'description']},
                    {model: models.channel_stream, required: false, attributes: [ 'id'], where: {stream_mode: stream_mode, stream_resolution: {[Op.like]: "%"+req.auth_obj.appid+"%"}}}
                ]
            },
            {model: models.program_schedule,
                required: false, //left join
                attributes: ['id'],
                where: {login_id: req.thisuser.id}
            }
        ]
    }).then(async function (epg_program) {
        if(!epg_program){
            var response_data = [{
                "genre": '',
                "program_title": '',
                "program_description": '',
                "channel_title": '',
                "channel_description": '',
                "status": '',
                "scheduled": false,
                "has_catchup": false
            }];
        }
        else {
            var status = '';
            if (epg_program.program_start.getTime() > Date.now()) {
                status = 'future';
            }
            else if (epg_program.program_end.getTime() < Date.now()) {
                status = 'catchup';
            }
            else {
                status = 'live';
            }
            var response_data = [{
                "genre": (epg_program.channel.genre.description) ? epg_program.channel.genre.description : '',
                "program_title": (epg_program.title) ? epg_program.title : '',
                "program_description": (epg_program.long_description) ? epg_program.long_description : '',
                "channel_title": (epg_program.channel.title) ? epg_program.channel.title : '',
                "channel_description": (epg_program.channel.description) ? epg_program.channel.description : '',
                "status": status,
                "scheduled": (!epg_program.program_schedules[0]) ? false : await schedule.isScheduled(epg_program.program_schedules[0].id),
                "has_catchup": (epg_program.channel.channel_streams[0]) ? true : false
            }];
        }
        response.send_res(req, res, response_data, 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'no-store');
    }).catch(function(error) {
        winston.error("Quering the event's data failed with error: ", error);
        response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
    });

};

//SCHEDULES / UNSCHEDULES A PROGRAM FOR A USER.
/**
 * @api {POST} /apiv2/channels/schedule Channels - schedule event
 * @apiName schedule_event
 * @apiGroup DeviceAPI
 *
 * @apiParam {String} auth Encrypted string composed of username, password, appid, boxid and timestamp.
 * @apiParam {Number} program_id Id  of the program to be scheduled / unscheduled
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "status_code": 200,
 *       "error_code": 1,
 *       "timestamp": 1517479302000, //unix timestamp in milliseconds
 *       "error_description": 'OK',
 *       "extra_data": 'OK_DATA', //message informs of the action (add/remove) performed for user and channel
 *       "response_object": [
 *          "action": "created" // values are created / destroyed / no action
 *       ]
 *   }
 */
exports.schedule = function(req, res) {
    models.epg_data.findOne({
        attributes: ['id', 'channel_number', 'program_start'],
        where: {id: req.body.program_id, company_id: req.thisuser.company_id}
    }).then(function (epg_program) {
        if(epg_program){
            models.program_schedule.findOne({
                attributes: ['id'], where: {login_id: req.thisuser.id, program_id: req.body.program_id},
            }).then(async function (scheduled) {
                if(!scheduled){
                    let t;
                    try {
                        t = await db.sequelize.transaction();

                        scheduled = await models.program_schedule.create({
                            login_id: req.thisuser.id,
                            program_id: req.body.program_id,
                            company_id: req.thisuser.company_id
                        }, {transaction: t});

                        var response_data = [{
                            "action": 'created'
                        }];
                        //programstart is converted to unix time, decreased by 5 min, decreased by current time. This gives the difference between the current time and 5 min before the start of the program
                        let delay = epg_program.program_start.getTime() - Date.now() - 60000;
                        if (delay < 0) {
                            await t.rollback();
                            response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
                            return;
                        }

                        await schedule.scheduleProgram(scheduled.id, delay, req.thisuser.id, req.body.program_id);

                        await t.commit();

                        response.send_res(req, res, response_data, 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'no-store');
                    } catch(error) {
                        if (t) {
                            await t.rollback();
                        }

                        winston.error("Creating record for scheduled event failed with error: ", error);
                        response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
                    }
                }
                else{
                    var eventid = scheduled.id;
                    models.program_schedule.destroy({
                        where: {login_id: req.thisuser.id, program_id: req.body.program_id}
                    }).then(async function (result){
                        var response_data = [{
                            "action": 'destroyed'
                        }];
                        await schedule.unscheduleProgram(eventid);
                        response.send_res(req, res, response_data, 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'no-store');
                    }).catch(function(error) {
                        winston.error("Deleting record for scheduled event failed with error: ", error);
                        response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
                    });
                }
                return null;
            }).catch(function(error) {
                winston.error("Searching for scheduled event failed with error: ", error);
                response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
            });
        }
        else{
            var response_data = [{
                "action": 'no action'
            }];
            response.send_res(req, res, response_data, 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'no-store');
        }
        return null;
    }).catch(function(error) {
        winston.error("Searching for the id of event to schedule failed with error: ", error);
        response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
    });
};

function set_stream_mode(channel){
    if(channel.catchup_mode){
        return 'catchup';
    }
    return 'live';
}

function program_status(programstart, programend){
    if(programstart < Date.now() && programend < Date.now()){
        return 1;
    }
    else if(programstart < Date.now() && programend > Date.now()){
        return 2;
    }
    else return 3
}
