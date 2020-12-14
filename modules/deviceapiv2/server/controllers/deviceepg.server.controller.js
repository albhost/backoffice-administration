'use strict';
var path = require('path'),
  db = require(path.resolve('./config/lib/sequelize')),
  Sequelize = require('sequelize'),
  db_funct = require(path.resolve("./custom_functions/sequelize_functions.js")),
  response = require(path.resolve("./config/responses.js")),
  winston = require(path.resolve('./config/lib/winston')),
  dateFormat = require('dateformat'),
  moment = require('moment'),
  async = require('async'),
  schedule = require('../../../../config/lib/scheduler'),
  models = db.models,
  epgFn = require('../../../../custom_functions/epg');

const {Op} = require('sequelize');
const Joi = require("joi")
const {getImagePerProgram} = require("../../../mago/server/controllers/program_content.server.controler");

exports.forwardPostEpgEventsToGet = function (req, res) {
  //Add to url so cache use it
  req.originalUrl += '?channelNumber=' + req.body.channelNumber;
  let timezone = '0';
  if (req.body.device_timezone) {
    timezone = req.body.device_timezone;
  }

  req.query = {
    channelNumber: req.body.channelNumber,
    device_timezone: timezone
  }

  req.method = 'get';

  req.app.handle(req, res);
}

exports.attachTimezoneToUrl = function (req, res, next) {
  let timezone = '0';
  if (req.query.device_timezone) {
    timezone = req.query.device_timezone;
    req.authParams.device_timezone = timezone;
  } else if (req.authParams.device_timezone) {
    timezone = req.authParams.device_timezone.replace(/ /g, '');
  }
  req.originalUrl += '&device_timezone=' + timezone;
  next();
}

//RETURNS 12 hours of future Epg for a given channel
/**
 * @api {POST} /apiv2/channels/event Channels - 12 hour epg
 * @apiName livetv_12hour_epg
 * @apiGroup DeviceAPI
 *
 * @apiParam {String} auth Encrypted string composed of username, password, appid, boxid and timestamp.
 * @apiParam {Number} channelNumber Channel numbers.
 * @apiParam {Number} device_timezone Timezone offset of the device. Values in range of [-12:12]
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
 *          "channelName": "channel name",
 *          "id": 1, //-1 for default epgs
 *          "number": 100, //channel number
 *          "title": "event title",
 *          "scheduled": true, //values true/false
 *          "description": "short event description",
 *          "shortname": "event short name",
 *          "programstart": "mm/dd/yyyy HH:MM:ss",
 *          "programend": "mm/dd/yyyy HH:MM:ss",
 *          "duration": 1800, //in seconds
 *          "progress": 20 //value in range [0:100] for current event, <0 for future events
 *       }, ....
 *       ]
 *   }
 */
exports.event = function (req, res) {
  let client_timezone = req.body.device_timezone; //offset of the client will be added to time - related info
  let current_human_time = dateFormat(Date.now(), "yyyy-mm-dd HH:MM:ss"); //get current time to compare with enddate
  let interval_end_human = dateFormat((Date.now() + 43200000), "yyyy-mm-dd HH:MM:ss"); //get current time to compare with enddate, in the interval of 12 hours
  let channel_title = '';

  models.channels.findOne({
    attributes: ['title'],
    where: {channel_number: req.body.channelNumber, company_id: req.thisuser.company_id}
  }).then(function (thischannel) {
    if (thischannel) channel_title = thischannel.title;
    models.my_channels.findOne({
      attributes: ['title'],
      where: {channel_number: req.body.channelNumber, company_id: req.thisuser.company_id}
    }).then(function (user_channel) {
      if (user_channel) channel_title = user_channel.title;
      models.epg_data.findAll({
        attributes: ['id', 'title', 'short_description', 'short_name', 'duration_seconds', 'program_start', 'program_end', 'long_description'],
        order: [['program_start', 'ASC']],
        limit: 6,
        include: [
          {
            model: models.channels, required: true, attributes: ['title', 'channel_number'],
            where: {channel_number: req.body.channelNumber} //limit data only for this channel
          },
          {
            model: models.program_schedule,
            required: false, //left join
            attributes: ['id'],
            where: {login_id: req.thisuser.id}
          }
        ],
        where: Sequelize.and(
          {program_start: {[Op.lte]: interval_end_human}, company_id: req.thisuser.company_id},
          Sequelize.or(
            Sequelize.and(
              {program_start: {[Op.lte]: current_human_time}},
              {program_end: {[Op.gte]: current_human_time}}
            ),
            Sequelize.and(
              {program_start: {[Op.gte]: current_human_time}},
              {program_end: {[Op.lte]: interval_end_human}}
            )
          )
        )
      }).then(async function (result) {
        let raw_result = [];

        for (let epgData of result) {
          let epg = {};
          let programstart = parseInt(epgData.program_start.getTime()) + parseInt((client_timezone) * 3600000);
          let programend = parseInt(epgData.program_end.getTime()) + parseInt((client_timezone) * 3600000);

          epg.channelName = epgData.channel.title;
          epg.id = epgData.id;
          epg.number = epgData.channel.channel_number;
          epg.title = epgData.title;
          epg.scheduled = (!epgData.program_schedules[0]) ? false : await schedule.isScheduled(epgData.program_schedules[0].id);
          epg.description = epgData.long_description;
          epg.shortname = epgData.short_description;
          epg.programstart = dateFormat(programstart, 'mm/dd/yyyy HH:MM:ss'); //add timezone offset to program_start timestamp, format it as M/D/Y H:m:s
          epg.programend = dateFormat(programend, 'mm/dd/yyyy HH:MM:ss'); //add timezone offset to program_start timestamp, format it as M/D/Y H:m:s
          epg.duration = epgData.duration_seconds;
          epg.progress = Math.round((Date.now() - epgData.program_start.getTime()) * 100 / (epgData.program_end.getTime() - epgData.program_start.getTime()));
          raw_result.push(epg);
        }

        if (result.length < 6) {
          for (var i = 0; i < 6 - result.length; i++) {
            var temp_obj = {};
            temp_obj.channelName = channel_title;
            temp_obj.id = -1;
            temp_obj.number = req.body.channelNumber;
            temp_obj.title = "Program of " + channel_title;
            temp_obj.scheduled = false;
            temp_obj.description = "Program of " + channel_title;
            temp_obj.shortname = "Program of " + channel_title;
            temp_obj.programstart = '01/01/1970 00:00:00';
            temp_obj.programend = '01/01/1970 00:00:00';
            temp_obj.duration = 0;
            temp_obj.progress = 0;
            raw_result.push(temp_obj);
          }
        }
        response.send_res(req, res, raw_result, 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'private,max-age=43200');
      }).catch(function (error) {
        winston.error("Getting the next 6 events failed with error: ", error);
        response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
      });
      return null;
    }).catch(function (error) {
      winston.error("Getting the list of the client's personal channels failed with error: ", error);
      response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
    });
    return null;
  }).catch(function (error) {
    winston.error("Getting the list of channels failed with error: ", error);
    response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
  });

};


/**
 * @api {GET} /apiv2/channels/event/:id Channels - 12 hour epg
 * @apiName livetv_12hour_epg
 * @apiGroup DeviceAPI
 *
 * @apiParam {String} auth Encrypted string composed of username, password, appid, boxid and timestamp.
 * @apiParam {Number} channelNumber Channel numbers.
 * @apiParam {Number} device_timezone Timezone offset of the device. Values in range of [-12:12]
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
 *          "channelName": "channel name",
 *          "id": 1, //-1 for default epgs
 *          "number": 100, //channel number
 *          "title": "event title",
 *          "scheduled": true, //values true/false
 *          "description": "short event description",
 *          "shortname": "event short name",
 *          "programstart": "mm/dd/yyyy HH:MM:ss",
 *          "programend": "mm/dd/yyyy HH:MM:ss",
 *          "duration": 1800, //in seconds
 *          "progress": 20 //value in range [0:100] for current event, <0 for future events
 *       }, ....
 *       ]
 *   }
 */
exports.event_get = function (req, res) {
  const client_timezone = req.body.device_timezone; //offset of the client will be added to time - related info
  const current_human_time = dateFormat(Date.now(), "yyyy-mm-dd HH:MM:ss"); //get current time to compare with enddate
  const interval_end_human = dateFormat((Date.now() + 43200000), "yyyy-mm-dd HH:MM:ss"); //get current time to compare with enddate, in the interval of 12 hours
  let channel_title = "";
  const channelNumber = req.params.channelId;

  models.channels.findOne({
    attributes: ['title'],
    where: {channel_number: channelNumber, company_id: req.thisuser.company_id}
  }).then(function (thischannel) {
    if (!thischannel) {
      return response.send_res(req, res, [], 706, -1, 'CHANNEL_NOT_FOUND', 'CHANNEL_NOT_FOUND', 'no-store');
    }
    if (thischannel) channel_title = thischannel.title;
    models.my_channels.findOne({
      attributes: ['title'],
      where: {channel_number: channelNumber, company_id: req.thisuser.company_id}
    }).then(function (user_channel) {
      if (user_channel) channel_title = user_channel.title;
      models.epg_data.findAll({
        attributes: ['id', 'title', 'short_description', 'short_name', 'duration_seconds', 'program_start', 'program_end', 'long_description'],
        order: [['program_start', 'ASC']],
        limit: 6,
        include: [
          {
            model: models.channels, required: true, attributes: ['title', 'channel_number'],
            where: {channel_number: channelNumber} //limit data only for this channel
          },
          {
            model: models.program_schedule,
            required: false, //left join
            attributes: ['id'],
            where: {login_id: req.thisuser.id}
          }
        ],
        where: Sequelize.and(
          {program_start: {[Op.lte]: interval_end_human}, company_id: req.thisuser.company_id},
          Sequelize.or(
            Sequelize.and(
              {program_start: {[Op.lte]: current_human_time}},
              {program_end: {[Op.gte]: current_human_time}}
            ),
            Sequelize.and(
              {program_start: {[Op.gte]: current_human_time}},
              {program_end: {[Op.lte]: interval_end_human}}
            )
          )
        )
      }).then(async function (result) {
        let raw_result = [];

        for (let epgData of result) {
          let epg = {};
          let programstart = parseInt(epgData.program_start.getTime()) + parseInt((client_timezone) * 3600000);
          let programend = parseInt(epgData.program_end.getTime()) + parseInt((client_timezone) * 3600000);

          epg.channelName = epgData.channel.title;
          epg.id = epgData.id;
          epg.number = epgData.channel.channel_number;
          epg.title = epgData.title;
          epg.scheduled = (!epgData.program_schedules[0]) ? false : await schedule.isScheduled(epgData.program_schedules[0].id);
          epg.description = epgData.long_description;
          epg.shortname = epgData.short_description;
          epg.programstart = dateFormat(programstart, 'mm/dd/yyyy HH:MM:ss'); //add timezone offset to program_start timestamp, format it as M/D/Y H:m:s
          epg.programend = dateFormat(programend, 'mm/dd/yyyy HH:MM:ss'); //add timezone offset to program_start timestamp, format it as M/D/Y H:m:s
          epg.duration = epgData.duration_seconds;
          epg.progress = Math.round((Date.now() - epgData.program_start.getTime()) * 100 / (epgData.program_end.getTime() - epgData.program_start.getTime()));
          raw_result.push(epg);
        }

        if (result.length < 6) {
          for (let i = 0; i < 6 - result.length; i++) {
            let temp_obj = {};
            temp_obj.channelName = channel_title;
            temp_obj.id = -1;
            temp_obj.number = req.body.channelNumber;
            temp_obj.title = "Program of " + channel_title;
            temp_obj.scheduled = false;
            temp_obj.description = "Program of " + channel_title;
            temp_obj.shortname = "Program of " + channel_title;
            temp_obj.programstart = '01/01/1970 00:00:00';
            temp_obj.programend = '01/01/1970 00:00:00';
            temp_obj.duration = 0;
            temp_obj.progress = 0;
            raw_result.push(temp_obj);
          }
        }
        response.send_res(req, res, raw_result, 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'private,max-age=43200');
      }).catch(function (error) {
        winston.error("Getting the next 6 events failed with error: ", error);
        response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
      });
      return null;
    }).catch(function (error) {
      winston.error("Getting the list of the client's personal channels failed with error: ", error);
      response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
    });
    return null;
  }).catch(function (error) {
    winston.error("Getting the list of channels failed with error: ", error);
    response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
  });

};


//RETURNS 12 hours of future Epg for a given channel - GET METHOD
/**
 * @api {GET} /apiv2/channels/event Channels - 12 hour epg
 * @apiName livetv_12hour_epg
 * @apiGroup DeviceAPI
 *
 * @apiParam {String} auth Encrypted string composed of username, password, appid, boxid and timestamp.
 * @apiParam {Number} channelNumber Channel numbers.
 * @apiParam {Number} device_timezone Timezone offset of the device. Values in range of [-12:12]
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
 *          "channelName": "channel name",
 *          "id": 1, //-1 for default epgs
 *          "number": 100, //channel number
 *          "title": "event title",
 *          "scheduled": true, //values true/false
 *          "description": "short event description",
 *          "shortname": "event short name",
 *          "programstart": "mm/dd/yyyy HH:MM:ss",
 *          "programend": "mm/dd/yyyy HH:MM:ss",
 *          "duration": 1800, //in seconds
 *          "progress": 20 //value in range [0:100] for current event, <0 for future events
 *       }, ....
 *       ]
 *   }
 */
exports.get_event = async function (req, res) {
  let channelNumber = req.query.channelNumber;
  if (!channelNumber) {
    response.send_res(req, res, [], 706, -1, 'BAD_REQUEST_DESCRIPTION', 'BAD_REQUEST_DATA', 'no-store');
    return;
  }

  let timezone = '0';
  if (req.authParams) {
    if (req.authParams['device_timezone']) {
      timezone = req.authParams['device_timezone'];
    }
  }
  timezone = timezone.replace(/ /g, '');

  let companyId = (req.headers.company_id) ? req.headers.company_id : 1
  let hoursOffset = parseInt(timezone);

  try {
    let assetUrl = req.app.locals.backendsettings[companyId].assets_url;
    let result = await epgFn.getOsdEpg(channelNumber, companyId, assetUrl);
    let programs = convertEpgToOldResponseFormat(result.epgs, result.channel, result.intervalStart, hoursOffset);
    response.send_res(req, res, programs, 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'no-store');
  } catch (err) {
    winston.error("Getting the list of channels failed with error: ", err);
    if (err.code == 404) {
      response.send_res(req, res, [], 706, -1, 'CHANNEL_NOT_FOUND', 'CHANNEL_NOT_FOUND', 'no-store');
    }
    else {
      response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
    }
  }
};

/**
 * @api {GET} /apiv2/channels/osd Get current and next epg
 * @apiName osd
 * @apiGroup DeviceAPI
 * @apiParam (Query param) {Number} channelNumber Channel number
 *
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *           "status_code": 200,
 *           "error_code": 1,
 *           "timestamp": 1,
 *           "error_description": "OK",
 *           "extra_data": "OK_DATA",
 *           "response_object": [
 *               {
 *                   "id": 337411,
 *                   "title": "Program title",
 *                   "short_name": "A short name for program",
 *                   "short_description": "A short description",
 *                   "long_description": "A long description",
 *                   "program_start": "2020-04-10T10:40:00.000Z",
 *                   "program_end": "2020-04-10T11:40:00.000Z",
 *                   "duration_seconds": 3600, (duration in seconds)
 *                   "channel": {
 *                       "title": "Channel title",
 *                       "channel_number": 304
 *                   }
 *               }
 *           ]
 *       }
 */
exports.get_osd = function (req, res) {
  let companyId = (req.headers.company_id) ? req.headers.company_id : 1
  let channelNumber = req.query.channelNumber;
  let intervalStart = new Date(Date.now()); //get current time to compare with enddate
  let intervalEnd = new Date(Date.now());
  intervalEnd.setHours(intervalEnd.getHours() + 12);
  models.channels.findOne({
    where: {company_id: companyId, channel_number: channelNumber}
  }).then(function (channel) {
    if (!channel) {
      response.send_res(req, res, [], 706, -1, 'CHANNEL_NOT_FOUND', 'CHANNEL_NOT_FOUND', 'no-store');
      return
    }

    models.epg_data.findAll({
      attributes: ['id', 'title', 'short_name', 'short_description', 'long_description', 'program_start', 'program_end', 'duration_seconds'],
      where: {
        company_id: companyId,
        program_start: {
          [Op.lte]: intervalEnd
        },
        program_end: {
          [Op.and]: [
            {[Op.lte]: intervalEnd},
            {[Op.gte]: intervalStart}
          ]
        }
      },
      order: [['program_start', 'ASC']],
      limit: 2,
      include: [
        {
          model: models.channels, required: true, attributes: ['title', 'channel_number'],
          where: {channel_number: channelNumber} //limit data only for this channel
        }
      ],
    }).then(function (epgs) {
      if (epgs.length == 0) {
        response.send_res(req, res, epgs, 200, 1, 'OK_DESCRIPTION', 'OK_DATA');
      } else {
        let cacheDuration = Math.round((epgs[epgs.length - 1].program_end.getTime() - new Date(Date.now()).getTime()) / 1000);
        response.send_res(req, res, epgs, 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'private,max-age=' + cacheDuration);
      }
    }).catch(function (err) {
      winston.error("Getting the list of channels failed with error: ", err);
      response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
    });
  })
};


//RETURNS EPG FOR PROGRAMS CURRENTLY BEING TRANSMITTED IN THE USER'S SUBSCRIBED CHANNELS FOR THIS DEVICE
/**
 * @api {post} /apiv2/channels/current_epgs Channels - current epg
 * @apiName livetv_current_epg
 * @apiGroup DeviceAPI
 *
 * @apiUse body_auth
 * @apiParam {String} auth Encrypted authentication token string.
 * @apiParam {Number} device_timezone Timezone offset of the device. Values in range of [-12:12]
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
 *          "channelName": "channel name"
 *          "title": "event title",
 *          "number": 100, //channel number
 *          "id": 1, //-1 for default epgs
 *          "scheduled": true, //values true/false
 *          "shortname": "event short name",*
 *          "description": "short event description",
 *          "programstart": "mm/dd/yyyy HH:MM:ss",
 *          "programend": "mm/dd/yyyy HH:MM:ss",
 *          "duration": 1800, //in seconds
 *          "progress": 20 //value in range [0:100] for current event, <0 for future events
 *          "status": 2 // static value, means that the event is currently being transmitted
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
exports.current_epgs = function (req, res) {
  const server_time = dateFormat(Date.now(), "yyyy-mm-dd HH:MM:ss"); //start of the day for the user, in server time
  const device_timezone = parseInt(req.query.device_timezone) || parseInt(req.authParams.device_timezone);
  let raw_result = [];

  let qwhere = {};
  if (req.thisuser.show_adult == 0) qwhere.pin_protected = 0; //show adults filter
  else qwhere.pin_protected !== ''; //avoid adult filter
  qwhere.company_id = req.thisuser.company_id;
  qwhere.isavailable = true;

  let stream_qwhere = {};
  stream_qwhere.stream_source_id = req.thisuser.channel_stream_source_id; // streams come from the user's stream source
  stream_qwhere.stream_mode = 'live';
  stream_qwhere.stream_resolution = {[Op.like]: "%" + req.auth_obj.appid + "%"};

  models.channels.findAll({
    attributes: ['title', 'channel_number'],
    order: [['channel_number', 'ASC']],
    where: qwhere,
    include: [
      {
        model: models.genre,
        required: true,
        attributes: [],
        where: {is_available: true}
      },
      {
        model: models.packages_channels,
        required: true,
        attributes: [],
        include: [
          {
            model: models.package,
            required: true,
            attributes: [],
            where: {package_type_id: req.auth_obj.screensize},
            include: [
              {
                model: models.subscription,
                required: true,
                attributes: [],
                where: {login_id: req.thisuser.id, end_date: {[Op.gte]: Date.now()}}
              }
            ]
          }
        ]
      },
      {
        model: models.channel_stream,
        required: true,
        attributes: [],
        where: stream_qwhere
      },
      {
        model: models.epg_data, required: false,
        attributes: [
          'id', 'title', 'short_description', 'long_description', 'short_name', 'duration_seconds',
          db_funct.final_time('program_start', 'program_start', 'HOUR', device_timezone, '%m/%d/%Y %H:%i:%s'),
          db_funct.final_time('program_end', 'program_end', 'HOUR', device_timezone, '%m/%d/%Y %H:%i:%s'),
          db_funct.add_constant(false, 'scheduled')
        ],
        where: {
          program_start: {[Op.lte]: server_time},
          program_end: {[Op.gte]: server_time},
          company_id: req.thisuser.company_id
        }
      }
    ]
  }).then(function (channels) {
    for (let i = 0; i < channels.length; i++) {
      let raw_obj = {};
      raw_obj.channelName = channels[i].title;
      raw_obj.title = (channels[i].epg_data[0]) ? channels[i].epg_data[0].title : "Program of " + channels[i].title;
      raw_obj.number = channels[i].channel_number;
      raw_obj.id = (channels[i].epg_data[0]) ? channels[i].epg_data[0].id : -1;
      raw_obj.scheduled = false;
      raw_obj.shortname = (channels[i].epg_data[0]) ? channels[i].epg_data[0].short_description : "Program of " + channels[i].title;
      raw_obj.description = (channels[i].epg_data[0]) ? channels[i].epg_data[0].long_description : "Program of " + channels[i].title;
      raw_obj.programstart = (channels[i].epg_data[0]) ? channels[i].epg_data[0].program_start : "01/01/1970 00:00:00";
      raw_obj.programend = (channels[i].epg_data[0]) ? channels[i].epg_data[0].program_end : "01/01/1970 00:00:00";
      raw_obj.duration = (channels[i].epg_data[0]) ? channels[i].epg_data[0].duration_seconds : 0;
      raw_obj.progress = (channels[i].epg_data[0]) ? Math.round(((Date.now() + 3600000 * device_timezone) - moment(channels[i].epg_data[0].program_start, 'MM/DD/YYYY HH:mm:ss').format('x')) / (channels[i].epg_data[0].duration_seconds * 10)) : 0;
      raw_obj.status = 2;

      raw_result.push(raw_obj);
    }
    response.send_res_get(req, res, raw_result, 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'private,max-age=43200');
  }).catch(function (error) {
    winston.error("Finding the channels available to the user failed with error: ", error);
    response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
  });

};


//RETURNS EPG FOR PROGRAMS CURRENTLY BEING TRANSMITTED IN THE USER'S SUBSCRIBED CHANNELS FOR THIS DEVICE
/**
 * @api {GET} /apiv2/channels/current_epgs Channels - current epg
 * @apiName livetv_current_epg
 * @apiGroup DeviceAPI
 *
 * @apiParam {String} auth Encrypted string composed of username, password, appid, boxid and timestamp.
 * @apiParam {Number} device_timezone Timezone offset of the device. Values in range of [-12:12]
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
 *          "channelName": "channel name"
 *          "title": "event title",
 *          "number": 100, //channel number
 *          "id": 1, //-1 for default epgs
 *          "scheduled": true, //values true/false
 *          "shortname": "event short name",*
 *          "description": "short event description",
 *          "programstart": "mm/dd/yyyy HH:MM:ss",
 *          "programend": "mm/dd/yyyy HH:MM:ss",
 *          "duration": 1800, //in seconds
 *          "progress": 20 //value in range [0:100] for current event, <0 for future eventsError deleting file at common controller, error:
 *          "status": 2 // static value, means that the event is currently being transmitted
 *       }, ....
 *       ]
 *   }
 */
exports.get_current_epgs = function (req, res) {
  const server_time = dateFormat(Date.now(), "yyyy-mm-dd HH:MM:ss"); //start of the day for the user, in server time
  const device_timezone = parseInt(req.query.device_timezone) || parseInt(req.authParams.device_timezone);

  let raw_result = [];

  let qwhere = {};
  if (req.thisuser.show_adult == 0) qwhere.pin_protected = 0; //show adults filter
  else qwhere.pin_protected !== ''; //avoid adult filter
  qwhere.company_id = req.thisuser.company_id;
  qwhere.isavailable = true;

  let stream_qwhere = {};
  stream_qwhere.stream_source_id = req.thisuser.channel_stream_source_id; // streams come from the user's stream source
  stream_qwhere.stream_mode = 'live';
  stream_qwhere.stream_resolution = {[Op.like]: "%" + req.auth_obj.appid + "%"};

  models.channels.findAll({
    attributes: ['title', 'channel_number'],
    order: [['channel_number', 'ASC']],
    where: qwhere,
    include: [
      {
        model: models.genre,
        required: true,
        attributes: [],
        where: {is_available: true}
      },
      {
        model: models.packages_channels,
        required: true,
        attributes: [],
        include: [
          {
            model: models.package,
            required: true,
            attributes: [],
            where: {package_type_id: req.auth_obj.screensize},
            include: [
              {
                model: models.subscription,
                required: true,
                attributes: [],
                where: {login_id: req.thisuser.id, end_date: {[Op.gte]: Date.now()}}
              }
            ]
          }
        ]
      },
      {
        model: models.channel_stream,
        required: true,
        attributes: [],
        where: stream_qwhere
      },
      {
        model: models.epg_data, required: false,
        attributes: [
          'id', 'title', 'short_description', 'long_description', 'short_name', 'duration_seconds',
          db_funct.final_time('program_start', 'program_start', 'HOUR', device_timezone, '%m/%d/%Y %H:%i:%s'),
          db_funct.final_time('program_end', 'program_end', 'HOUR', device_timezone, '%m/%d/%Y %H:%i:%s'),
          db_funct.add_constant(false, 'scheduled')
        ],
        where: {
          program_start: {[Op.lte]: server_time},
          program_end: {[Op.gte]: server_time},
          company_id: req.thisuser.company_id
        }
      }
    ]
  }).then(function (channels) {
    for (let i = 0; i < channels.length; i++) {
      let raw_obj = {};
      raw_obj.channelName = channels[i].title;
      raw_obj.title = (channels[i].epg_data[0]) ? channels[i].epg_data[0].title : "Program of " + channels[i].title;
      raw_obj.number = channels[i].channel_number;
      raw_obj.id = (channels[i].epg_data[0]) ? channels[i].epg_data[0].id : -1;
      raw_obj.scheduled = false;
      raw_obj.shortname = (channels[i].epg_data[0]) ? channels[i].epg_data[0].short_description : "Program of " + channels[i].title;
      raw_obj.description = (channels[i].epg_data[0]) ? channels[i].epg_data[0].long_description : "Program of " + channels[i].title;
      raw_obj.programstart = (channels[i].epg_data[0]) ? channels[i].epg_data[0].program_start : "01/01/1970 00:00:00";
      raw_obj.programend = (channels[i].epg_data[0]) ? channels[i].epg_data[0].program_end : "01/01/1970 00:00:00";
      raw_obj.duration = (channels[i].epg_data[0]) ? channels[i].epg_data[0].duration_seconds : 0;
      raw_obj.progress = (channels[i].epg_data[0]) ? Math.round(((Date.now() + 3600000 * device_timezone) - moment(channels[i].epg_data[0].program_start, 'MM/DD/YYYY HH:mm:ss').format('x')) / (channels[i].epg_data[0].duration_seconds * 10)) : 0;
      raw_obj.status = 2;

      raw_result.push(raw_obj);
    }
    response.send_res_get(req, res, raw_result, 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'private,max-age=43200');
  }).catch(function (error) {
    winston.error("Finding the channels available to the user failed with error: ", error);
    response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
  });
};

//RETURNS 4 hours of Epg for the channels listed in the number parameter
/**
 * @api {POST} /apiv2/channels/epg Channels - 4 hour epg
 * @apiName livetv_4hour_epg
 * @apiGroup DeviceAPI
 *
 * @apiParam {String} auth Encrypted string composed of username, password, appid, boxid and timestamp.
 * @apiParam {String} number Comma-separated list of channel numbers.
 * @apiParam {Number} timeshift Represents number of epg page in the application
 * @apiParam {Number} device_timezone Timezone offset of the device. Values in range of [-12:12]
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
 *          "channelName": "channel name",
 *          "number": 100, //channel number
 *          "id": 1, //-1 for default epgs
 *          "scheduled": true, //values true/false
 *          "title": "event title",
 *          "description": "short event description",
 *          "shortname": "event short name",
 *          "programstart": "mm/dd/yyyy HH:MM:ss",
 *          "programend": "mm/dd/yyyy HH:MM:ss",
 *          "duration": 1800 //in seconds
 *       }, ....
 *       ]
 *   }
 */
exports.epg = function (req, res) {
  let client_timezone = req.body.device_timezone;
  //request parameters: list of channel numbers for the epg, timeshift
  let channel_number = req.body.number.toString().split(',');
  let timeshift = req.body.timeshift;

  let starttime = dateFormat((Date.now() + (parseInt(timeshift) + 2) * 3600000), "yyyy-mm-dd HH:MM:ss");
  let endtime = dateFormat((Date.now() + (parseInt(timeshift) - 2) * 3600000), "yyyy-mm-dd HH:MM:ss");

  //gets epg of the channels from the list for the next 4 hours starting from timeshift
  models.epg_data.findAll({
    attributes: ['id', 'title', 'short_description', 'short_name', 'duration_seconds', 'program_start', 'program_end', 'channel_number', 'long_description'],
    include: [
      {
        model: models.channels, required: true, attributes: ['title', 'channel_number'],
        where: {channel_number: {[Op.in]: channel_number}} //limit data only for this list of channels
      },
      {
        model: models.program_schedule,
        required: false, //left join
        attributes: ['id'], where: {login_id: req.thisuser.id}
      }
    ],
    order: [['channel_number', 'ASC'], ['program_start', 'ASC']],
    where: Sequelize.and(
      {company_id: req.thisuser.company_id},
      Sequelize.or(
        {program_start: {[Op.between]: [starttime, endtime]}},
        {program_end: {[Op.between]: [starttime, endtime]}},
        Sequelize.and(
          {program_start: {[Op.lte]: starttime}},
          {program_end: {[Op.gte]: endtime}}
        )
      )
    )
  }).then(async function (result) {
    let raw_result = [];
    for (let epgData of result) {
      let epg = {};
      let programstart = parseInt(epgData.program_start.getTime()) + parseInt((client_timezone) * 3600000);
      let programend = parseInt(epgData.program_end.getTime()) + parseInt((client_timezone) * 3600000);

      epg.channelName = epgData.channel.title;
      epg.id = epgData.id;
      epg.number = epgData.channel.channel_number;
      epg.title = epgData.title;
      epg.scheduled = (!epgData.program_schedules[0]) ? false : await schedule.isScheduled(epgData.program_schedules[0].id);
      epg.description = epgData.long_description;
      epg.shortname = epgData.short_description;
      epg.programstart = dateFormat(programstart, 'mm/dd/yyyy HH:MM:ss'); //add timezone offset to program_start timestamp, format it as M/D/Y H:m:s
      epg.programend = dateFormat(programend, 'mm/dd/yyyy HH:MM:ss'); //add timezone offset to program_start timestamp, format it as M/D/Y H:m:s
      epg.duration = epgData.duration_seconds;
      epg.progress = Math.round((Date.now() - epgData.program_start.getTime()) * 100 / (epgData.program_end.getTime() - epgData.program_start.getTime()));
      raw_result.push(epg);
    }

    response.send_res(req, res, raw_result, 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'private,max-age=43200');
  }).catch(function (error) {
    winston.error("Finding the events in the 4 hour timeframe failed with error: ", error);
    response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
  });

};


//RETURNS 4 hours of Epg for the channels listed in the number parameter - GET METHOD
/**
 * @api {GET} /apiv2/channels/epg Channels - 4 hour epg
 * @apiName livetv_4hour_epg
 * @apiGroup DeviceAPI
 *
 * @apiParam {String} auth Encrypted string composed of username, password, appid, boxid and timestamp.
 * @apiParam {String} number Comma-separated list of channel numbers.
 * @apiParam {Number} timeshift Represents number of epg page in the application
 * @apiParam {Number} device_timezone Timezone offset of the device. Values in range of [-12:12]
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
 *          "channelName": "channel name",
 *          "number": 100, //channel number
 *          "id": 1, //-1 for default epgs
 *          "scheduled": true, //values true/false
 *          "title": "event title",
 *          "description": "short event description",
 *          "shortname": "event short name",
 *          "programstart": "mm/dd/yyyy HH:MM:ss",
 *          "programend": "mm/dd/yyyy HH:MM:ss",
 *          "duration": 1800 //in seconds
 *       }, ....
 *       ]
 *   }
 */
exports.get_epg = function (req, res) {
  let client_timezone = req.query.device_timezone;
  //request parameters: list of channel numbers for the epg, timeshift
  let channel_number = req.query.number.toString().split(',');
  let timeshift = req.query.timeshift;

  let starttime = dateFormat((Date.now() + (parseInt(timeshift) + 2) * 3600000), "yyyy-mm-dd HH:MM:ss");
  let endtime = dateFormat((Date.now() + (parseInt(timeshift) - 2) * 3600000), "yyyy-mm-dd HH:MM:ss");

  //gets epg of the channels from the list for the next 4 hours starting from timeshift
  models.epg_data.findAll({
    attributes: ['id', 'title', 'short_description', 'short_name', 'duration_seconds', 'program_start', 'program_end', 'channel_number', 'long_description'],
    include: [
      {
        model: models.channels, required: true, attributes: ['title', 'channel_number'],
        where: {channel_number: {[Op.in]: channel_number}} //limit data only for this list of channels
      },
      {
        model: models.program_schedule,
        required: false, //left join
        attributes: ['id'], where: {login_id: req.thisuser.id}
      }
    ],
    order: [['channel_number', 'ASC'], ['program_start', 'ASC']],
    where: Sequelize.and(
      {company_id: req.thisuser.company_id},
      Sequelize.or(
        {program_start: {[Op.between]: [starttime, endtime]}},
        {program_end: {[Op.between]: [starttime, endtime]}},
        Sequelize.and(
          {program_start: {[Op.lte]: starttime}},
          {program_end: {[Op.gte]: endtime}}
        )
      )
    )
  }).then(async function (result) {
    let raw_result = [];
    for (let epgData of result) {
      let epg = {};
      let programstart = parseInt(epgData.program_start.getTime()) + parseInt((client_timezone) * 3600000);
      let programend = parseInt(epgData.program_end.getTime()) + parseInt((client_timezone) * 3600000);

      epg.channelName = epgData.channel.title;
      epg.id = epgData.id;
      epg.number = epgData.channel.channel_number;
      epg.title = epgData.title;
      epg.scheduled = (!epgData.program_schedules[0]) ? false : await schedule.isScheduled(epgData.program_schedules[0].id);
      epg.description = epgData.long_description;
      epg.shortname = epgData.short_description;
      epg.programstart = dateFormat(programstart, 'mm/dd/yyyy HH:MM:ss'); //add timezone offset to program_start timestamp, format it as M/D/Y H:m:s
      epg.programend = dateFormat(programend, 'mm/dd/yyyy HH:MM:ss'); //add timezone offset to program_start timestamp, format it as M/D/Y H:m:s
      epg.duration = epgData.duration_seconds;
      epg.progress = Math.round((Date.now() - epgData.program_start.getTime()) * 100 / (epgData.program_end.getTime() - epgData.program_start.getTime()));
      raw_result.push(epg);
    }

    response.send_res_get(req, res, raw_result, 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'private,max-age=43200');
  }).catch(function (error) {
    winston.error("Getting the events of the 4 hour timeframe failed with error: ", error);
    response.send_res_get(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
  });

};


//RETURNS ENTIRE EPG FOR A SPECIFIC CHANNEL IN A SPECIFIC DAY
/**
 * @api {POST} /apiv2/channels/daily_epg Channels - daily epg
 * @apiName livetv_daily_epg
 * @apiGroup DeviceAPI
 *
 * @apiParam {String} auth Encrypted string composed of username, password, appid, boxid and timestamp.
 * @apiParam {Number} channel_number Channel number
 * @apiParam {Number} device_timezone Timezone offset of the device. Values in range of [-12:12]
 * @apiParam {Number} day 0 for today, -x/x for other days.
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
 *          "channelName": "channel name"
 *          "id": 1, //-1 for default epgs
 *          "number": 100, //channel number
 *          "title": "event title",
 *          "scheduled": true, //values true/false
 *          "description": "short event description",
 *          "shortname": "event short name",
 *          "programstart": "mm/dd/yyyy HH:MM:ss",
 *          "programend": "mm/dd/yyyy HH:MM:ss",
 *          "duration": 1800, //in seconds
 *          "progress": 20 //value in range [0:100] for current event, <0 for future events
 *          "status": 2 // 1 for past, 2 for current, 3 for future events
 *       }, ....
 *       ]
 *   }
 */
exports.daily_epg = function (req, res) {
  let client_timezone = req.body.device_timezone; //offset of the client will be added to time - related info
  let interval_start = dateFormat(Date.now() - client_timezone * 3600 + req.body.day * 3600000 * 24, "yyyy-mm-dd 00:00:00"); //start of the day for the user, in server time
  let interval_end = dateFormat((Date.now() - client_timezone * 3600 + req.body.day * 3600000 * 24), "yyyy-mm-dd 23:59:59"); //end of the day for the user, in server time

  async.auto({
    get_channel: function (callback) {
      models.channels.findOne({
        attributes: ['title'],
        where: {channel_number: req.body.channel_number, company_id: req.thisuser.company_id}
      }).then(function (channel) {
        if (!channel) {
          models.my_channels.findOne({
            attributes: ['title'],
            where: {channel_number: req.body.channel_number, company_id: req.thisuser.company_id}
          }).then(function (user_channel) {
            if (!user_channel) {
              response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
            } else callback(null, user_channel);
          }).catch(function (error) {
            winston.error("Finding the title of the client's personal channel failed with error: ", error);
            response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
          });
        } else callback(null, channel.title);
        return null;
      }).catch(function (error) {
        winston.error("Finding the channel's title failed with error: ", error);
        response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
      });
    },
    get_epg: ['get_channel', function (results, callback) {
      models.epg_data.findAll({
        attributes: ['id', 'title', 'short_description', 'short_name', 'duration_seconds', 'program_start', 'program_end', 'long_description'],
        order: [['program_start', 'ASC']],
        include: [
          {
            model: models.channels, required: true, attributes: [], where: {channel_number: req.body.channel_number},
            include: {
              model: models.packages_channels, required: true, attributes: [],
              include: [{
                model: models.package, required: true, attributes: [],
                where: {package_type_id: req.auth_obj.screensize},
                include: [{
                  model: models.subscription,
                  required: true,
                  attributes: [],
                  where: {login_id: req.thisuser.id, end_date: {[Op.gte]: Date.now()}}
                }
                ]
              }
              ]
            }
          },
          {
            model: models.program_schedule,
            required: false, //left join
            attributes: ['id'],
            where: {login_id: req.thisuser.id}
          }
        ],
        where: {
          program_start: {[Op.gte]: interval_start},
          program_end: {[Op.lte]: interval_end},
          company_id: req.thisuser.company_id
        }
      }).then(function (result) {
        if (!result) {
          callback(null, results.get_channel, []); //no epg for this channel, passing empty array instead
        } else callback(null, results.get_channel, result);
      }).catch(function (error) {
        winston.error("Finding the events for the current day failed with error: ", error);
        response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
      });
    }],
    send_epg: ['get_epg', async function (epg_data, callback) {
      var raw_result = [];
      if (epg_data.get_epg[1].length < 3) {
        for (var i = 0; i < 3 - epg_data.get_epg[1].length; i++) {
          var temp_obj = {};
          temp_obj.channelName = epg_data.get_epg[0];
          temp_obj.id = -1;
          temp_obj.number = req.body.channel_number;
          temp_obj.title = "Program of " + epg_data.get_epg[0];
          temp_obj.scheduled = false;
          temp_obj.description = "Program of " + epg_data.get_epg[0];
          temp_obj.shortname = "Program of " + epg_data.get_epg[0];
          temp_obj.programstart = '01/01/1970 00:00:00';
          temp_obj.programend = '01/01/1970 00:00:00';
          temp_obj.duration = 0; //duration 0 for non-real epg
          temp_obj.progress = 0; //progress 0 for non-real epg
          temp_obj.status = 0; //status 0 means this is non-real epg
          raw_result.push(temp_obj);
        }
      }
      for (var i = 0; i < epg_data.get_epg[1].length; i++) {
        var temp_obj = {};
        var programstart = parseInt(epg_data.get_epg[1][i].program_start.getTime()) + parseInt((client_timezone) * 3600000);
        var programend = parseInt(epg_data.get_epg[1][i].program_end.getTime()) + parseInt((client_timezone) * 3600000);

        temp_obj.channelName = epg_data.get_epg[0];
        temp_obj.id = epg_data.get_epg[1][i].id;
        temp_obj.number = req.body.channel_number;
        temp_obj.title = epg_data.get_epg[1][i].title;
        temp_obj.scheduled = (!epg_data.get_epg[1][i].program_schedules[0]) ? false : await schedule.isScheduled(epg_data.get_epg[1][i].program_schedules[0].id);
        temp_obj.status = program_status(epg_data.get_epg[1][i].program_start.getTime(), epg_data.get_epg[1][i].program_end.getTime());
        temp_obj.description = epg_data.get_epg[1][i].long_description;
        temp_obj.shortname = epg_data.get_epg[1][i].short_description;
        temp_obj.programstart = dateFormat(programstart, 'mm/dd/yyyy HH:MM:ss'); //add timezone offset to program_start timestamp, format it as M/D/Y H:m:s
        temp_obj.programend = dateFormat(programend, 'mm/dd/yyyy HH:MM:ss'); //add timezone offset to program_start timestamp, format it as M/D/Y H:m:s
        temp_obj.duration = epg_data.get_epg[1][i].duration_seconds;
        temp_obj.progress = Math.round((Date.now() - epg_data.get_epg[1][i].program_start.getTime()) / (epg_data.get_epg[1][i].duration_seconds * 10));
        raw_result.push(temp_obj);
      }
      response.send_res(req, res, raw_result, 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'private,max-age=86400');
    }]
  }, function (error, results) {
    if (error) {
      response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
    }
  });

};


//RETURNS ENTIRE EPG FOR A SPECIFIC CHANNEL IN A SPECIFIC DAY
/**
 * @api {GET} /apiv2/channels/daily_epg Channels - daily epg
 * @apiName livetv_daily_epg
 * @apiGroup DeviceAPI
 *
 * @apiParam {String} auth Encrypted string composed of username, password, appid, boxid and timestamp.
 * @apiParam {Number} channel_number Channel number
 * @apiParam {Number} device_timezone Timezone offset of the device. Values in range of [-12:12]
 * @apiParam {Number} day 0 for today, -x/x for other days.
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
 *          "channelName": "channel name"
 *          "id": 1, //-1 for default epgs
 *          "number": 100, //channel number
 *          "title": "event title",
 *          "scheduled": true, //values true/false
 *          "description": "short event description",
 *          "shortname": "event short name",
 *          "programstart": "mm/dd/yyyy HH:MM:ss",
 *          "programend": "mm/dd/yyyy HH:MM:ss",
 *          "duration": 1800, //in seconds
 *          "progress": 20 //value in range [0:100] for current event, <0 for future events
 *          "status": 2 // 1 for past, 2 for current, 3 for future events
 *       }, ....
 *       ]
 *   }
 */
exports.get_daily_epg = function (req, res) {

  var client_timezone = req.query.device_timezone;
  var interval_start = dateFormat(Date.now() - client_timezone * 3600 + req.query.day * 3600000 * 24, "yyyy-mm-dd 00:00:00"); //start of the day for the user, in server time
  var interval_end = dateFormat((Date.now() - client_timezone * 3600 + req.query.day * 3600000 * 24), "yyyy-mm-dd 23:59:59"); //end of the day for the user, in server time
  var channel_number = req.query.channel_number;

  async.auto({
    get_channel: function (callback) {
      models.channels.findOne({
        attributes: ['title'],
        where: {channel_number: channel_number, company_id: req.thisuser.company_id}
      }).then(function (channel) {
        if (!channel) {
          models.my_channels.findOne({
            attributes: ['title'],
            where: {channel_number: channel_number, company_id: req.thisuser.company_id}
          }).then(function (user_channel) {
            if (!user_channel) {
              response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
            } else callback(null, user_channel);
          }).catch(function (error) {
            winston.error("Getting the title of the client's personal channel failed with error: ", error);
            response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
          });
        } else callback(null, channel.title);
        return null;
      }).catch(function (error) {
        winston.error("Getting the channel's title failed with error: ", error);
        response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
      });
    },
    get_epg: ['get_channel', function (results, callback) {
      models.epg_data.findAll({
        attributes: ['id', 'title', 'short_description', 'short_name', 'duration_seconds', 'program_start', 'program_end', 'long_description'],
        order: [['program_start', 'ASC']],
        include: [
          {
            model: models.channels, required: true, attributes: [], where: {channel_number: channel_number},
            include: {
              model: models.packages_channels, required: true, attributes: [],
              include: [{
                model: models.package, required: true, attributes: [],
                where: {package_type_id: req.auth_obj.screensize},
                include: [{
                  model: models.subscription,
                  required: true,
                  attributes: [],
                  where: {login_id: req.thisuser.id, end_date: {[Op.gte]: Date.now()}}
                }
                ]
              }
              ]
            }
          },
          {
            model: models.program_schedule,
            required: false, //left join
            attributes: ['id'],
            where: {login_id: req.thisuser.id}
          }
        ],
        where: {
          program_start: {[Op.gte]: interval_start},
          program_end: {[Op.lte]: interval_end},
          company_id: req.thisuser.company_id
        }
      }).then(function (result) {
        if (!result) {
          callback(null, results.get_channel, []); //no epg for this channel, passing empty array instead
        } else callback(null, results.get_channel, result);
      }).catch(function (error) {
        winston.error("Getting the events for a specific day failed with error: ", error);
        response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
      });
    }],
    send_epg: ['get_epg', async function (epg_data, callback) {
      var raw_result = [];
      if (epg_data.get_epg[1].length < 3) {
        for (var i = 0; i < 3 - epg_data.get_epg[1].length; i++) {
          var temp_obj = {};
          temp_obj.channelName = epg_data.get_epg[0];
          temp_obj.id = -1;
          temp_obj.number = channel_number;
          temp_obj.title = "Program of " + epg_data.get_epg[0];
          temp_obj.scheduled = false;
          temp_obj.description = "Program of " + epg_data.get_epg[0];
          temp_obj.shortname = "Program of " + epg_data.get_epg[0];
          temp_obj.programstart = '01/01/1970 00:00:00';
          temp_obj.programend = '01/01/1970 00:00:00';
          temp_obj.duration = 0; //duration 0 for non-real epg
          temp_obj.progress = 0; //progress 0 for non-real epg
          temp_obj.status = 0; //status 0 means this is non-real epg
          raw_result.push(temp_obj);
        }
      }
      for (var i = 0; i < epg_data.get_epg[1].length; i++) {
        var temp_obj = {};
        var programstart = parseInt(epg_data.get_epg[1][i].program_start.getTime()) + parseInt((client_timezone) * 3600000);
        var programend = parseInt(epg_data.get_epg[1][i].program_end.getTime()) + parseInt((client_timezone) * 3600000);

        temp_obj.channelName = epg_data.get_epg[0];
        temp_obj.id = epg_data.get_epg[1][i].id;
        temp_obj.number = channel_number;
        temp_obj.title = epg_data.get_epg[1][i].title;
        temp_obj.scheduled = (!epg_data.get_epg[1][i].program_schedules[0]) ? false : await schedule.isScheduled(epg_data.get_epg[1][i].program_schedules[0].id);
        temp_obj.status = program_status(epg_data.get_epg[1][i].program_start.getTime(), epg_data.get_epg[1][i].program_end.getTime());
        temp_obj.description = epg_data.get_epg[1][i].long_description;
        temp_obj.shortname = epg_data.get_epg[1][i].short_description;
        temp_obj.programstart = dateFormat(programstart, 'mm/dd/yyyy HH:MM:ss'); //add timezone offset to program_start timestamp, format it as M/D/Y H:m:s
        temp_obj.programend = dateFormat(programend, 'mm/dd/yyyy HH:MM:ss'); //add timezone offset to program_start timestamp, format it as M/D/Y H:m:s
        temp_obj.duration = epg_data.get_epg[1][i].duration_seconds;
        temp_obj.progress = Math.round((Date.now() - epg_data.get_epg[1][i].program_start.getTime()) / (epg_data.get_epg[1][i].duration_seconds * 10));
        raw_result.push(temp_obj);
      }
      response.send_res_get(req, res, raw_result, 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'private,max-age=86400');
    }]
  }, function (error, results) {
    if (error) {
      response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
    }
  });

};


// to be remove, replaced by function get_epg_data
exports.test_get_epg_data = function (req, res) {

  var timeshift = 0;
  var minusminutes = isNaN(parseInt(req.query._start)) ? -180 : parseInt(req.query._start);
  var plusminutes = isNaN(parseInt(req.query._end)) ? 1440 : parseInt(req.query._end);
  var starttime = (Date.now() + minusminutes * 60000);
  var endtime = (Date.now() + plusminutes * 60000);

  if (req.query.channelnumbers) {
    var channelnumbers = req.query.channelnumbers.toString().split(',');
  } else {
    var channelnumbers = [];
  }

  var final_where = {};

  final_where.attributes = ['id', 'channel_number', 'title', [db.sequelize.fn("concat", req.app.locals.backendsettings[req.thisuser.company_id].assets_url, db.sequelize.col('icon_url')), 'icon_url']],
    final_where.include = [{
      model: models.epg_data,
      attributes: ['title', 'short_name', 'short_description', 'long_description', 'program_start', 'program_end', 'duration_seconds', 'long_description'],
      required: false,
      where: Sequelize.and(
        {company_id: req.thisuser.company_id},
        {program_start: {[Op.gte]: starttime}},
        {program_start: {[Op.lte]: endtime}}
      )
    }];

  if (channelnumbers.length > 0) final_where.where = {channel_number: {[Op.in]: channelnumbers}}; //limit data only for this list of channels

  final_where.order = ['channel_number'];
  final_where.where.company_id = req.thisuser.company_id;

  models.channels.findAll(
    final_where
  ).then(function (result) {
    res.send(result);
  }).catch(function (error) {
    winston.error("Finding the events for a specific list of channels failed with error: ", error);
    res.send(error);
  });
};


/**
 * @api {get} /apiv2/channels/epgdata Request Channels EPG Data
 * @apiName epgdata
 * @apiGroup EPG
 *
 * @apiHeader {String} auth End User auth token.
 *
 * @apiParam {Number} [_start]  Optional start time in minutes. If missing equals -180
 * @apiParam {Number} [_end] Optional end time in minutes. If missing equals 1440
 * @apiParam {String[]} [channelnumbers] Optional channel number separated by comma
 *
 *@apiDescription Copy paste this auth for testing purposes
 *auth=/ihCuMthnmY7pV3WLgC68i70zwLp6DUrLyFe9dOUEkxUBFH9WrUcA95GFAecSJH9HG9tvymreMOFlBviVd3IcII4Z/SiurlGoz9AMtE5KGFZvCl1FQ3FKZYP3LeFgzVs\r\nDQjxaup3sKRljj4lmKUDTA==
 *
 */

exports.get_epg_data = function (req, res) {

  var timeshift = 0;
  var minusminutes = isNaN(parseInt(req.query._start)) ? -180 : parseInt(req.query._start);
  var plusminutes = isNaN(parseInt(req.query._end)) ? 1440 : parseInt(req.query._end);
  var starttime = (Date.now() + minusminutes * 60000);
  var endtime = (Date.now() + plusminutes * 60000);

  if (req.query.channelnumbers) {
    var channelnumbers = req.query.channelnumbers.toString().split(',');
  } else {
    var channelnumbers = [];
  }

  var final_where = {};

  final_where.attributes = ['id', 'channel_number', 'title', [db.sequelize.fn("concat", req.app.locals.backendsettings[req.thisuser.company_id].assets_url, db.sequelize.col('channels.icon_url')), 'icon_url']];
    final_where.include = [{
      model: models.epg_data,
      attributes: ['id', 'title', 'short_name', 'short_description', 'long_description', 'program_start', 'program_end', 'duration_seconds', 'long_description'],
      required: false,
      //where: Sequelize.and(
      //    {company_id: req.thisuser.company_id},
      //    {program_start: {[Op.gte]:starttime}},
      //    {program_start: {[Op.lte]:endtime}}
      //),
      where: Sequelize.and(
        {company_id: req.thisuser.company_id},
        Sequelize.or(
          Sequelize.and(
            {program_start: {[Op.gte]: starttime}},
            {program_start: {[Op.lte]: endtime}}
          ),
          Sequelize.and(
            {program_end: {[Op.gte]: starttime}},
            {program_end: {[Op.lte]: endtime}}
          )
        )
      ),

      include: [{
        model: models.program_schedule,
        attributes: ['id'],
        required: false,
        where: {login_id: req.thisuser.id}
      }]
    }];

  if (channelnumbers.length > 0) final_where.where = {channel_number: {[Op.in]: channelnumbers}}; //limit data only for this list of channels

  final_where.order = ['channel_number'];

  models.channels.findAll(
    final_where
  ).then(function (result) {
    res.send(result);
  }).catch(function (error) {
    winston.error("Getting the events for a specific list of channels failed with error: ", error);
    res.send(error);
  });
};

function convertEpgToOldResponseFormat(epgs, channel, intervalStart, hoursOffset) {
  let programs = []

  if (!epgs || epgs.length == 0) {
    programs.push(createDummyEpg(channel.channel_number, channel.title));
    programs.push(createDummyEpg(channel.channel_number, channel.title));
    return programs;
  }

  let noCurrentEpg = false;
  let clientTime = new Date();
  clientTime.setHours(clientTime.getHours() + hoursOffset);

  if (epgs.length > 0) {
    let epg = epgs[0];
    let programStart = new Date(epg.program_start);
    let programEnd = new Date(epg.program_end);

    //Check if epg is not playing now but is in featureplaying at this time
    if (programStart.getTime() - intervalStart.getTime() > 5000) {
      noCurrentEpg = true;
      programs.push(createDummyEpg(channel.channel_number, channel.title));
    }
    //apply timezone
    programStart.setHours(programStart.getHours() + hoursOffset);
    programEnd.setHours(programEnd.getHours() + hoursOffset);

    let program = {
      id: epg.id,
      channelName: epg.channel.title,
      number: epg.channel.channel_number,
      title: epg.title,
      scheduled: false,
      description: epg.long_description,
      shortname: epg.short_description,
      programstart: dateFormat(programStart, 'UTC:mm/dd/yyyy HH:MM:ss'), //add timezone offset to program_start timestamp, format it as M/D/Y H:m:s
      programend: dateFormat(programEnd, 'UTC:mm/dd/yyyy HH:MM:ss'), //add timezone offset to program_start timestamp, format it as M/D/Y H:m:s
      duration: epg.duration_seconds,
      progress: Math.round((clientTime.getTime() - programStart.getTime()) * 100 / (programEnd.getTime() - programStart.getTime()))
    }
    programs.push(program)
  }

  if (noCurrentEpg == false) {
    if (epgs.length > 1) {
      let epg = epgs[1];
      let programStart = new Date(epg.program_start);
      let programEnd = new Date(epg.program_end);

      //apply timezone
      programStart.setHours(programStart.getHours() + hoursOffset);
      programEnd.setHours(programEnd.getHours() + hoursOffset);
      let program = {
        id: epg.id,
        channelName: epg.channel.title,
        number: epg.channel.channel_number,
        title: epg.title,
        scheduled: false,
        description: epg.long_description,
        shortname: epg.short_description,
        programstart: dateFormat(programStart, 'UTC:mm/dd/yyyy HH:MM:ss'), //add timezone offset to program_start timestamp, format it as M/D/Y H:m:s
        programend: dateFormat(programEnd, 'UTC:mm/dd/yyyy HH:MM:ss'), //add timezone offset to program_start timestamp, format it as M/D/Y H:m:s
        duration: epg.duration_seconds,
        progress: Math.round((clientTime.getTime() - programStart.getTime()) * 100 / (programEnd.getTime() - programStart.getTime()))
      }
      programs.push(program)
    } else {
      programs.push(createDummyEpg(channel.channel_number, channel.title));
    }
  }

  return programs;
}

function createDummyEpg(channelNumber, channelTitle) {
  return {
    id: -1,
    channelName: channelTitle,
    number: channelNumber,
    title: 'Programs of ' + channelTitle,
    scheduled: false,
    description: 'Programs of ' + channelTitle,
    shortname: 'Programs of ' + channelTitle,
    programstart: '01/01/1970 00:00:00', //add timezone offset to program_start timestamp, format it as M/D/Y H:m:s
    programend: '01/01/1970 00:00:00', //add timezone offset to program_start timestamp, format it as M/D/Y H:m:s
    duration: 0,
    progress: 0
  }
}

function program_status(programstart, programend) {
  if (programstart < Date.now() && programend < Date.now()) {
    return 1;
  } else if (programstart < Date.now() && programend > Date.now()) {
    return 2;
  } else return 3
}

/**
 * @api {get} /apiv2/channels/epg/data Request Channels EPG Data with images
 * @apiName epgdata
 * @apiGroup EPG
 *
 * @apiHeader {String} auth End User auth token.
 *
 * @apiParam {Number} [_start]  Optional start time in minutes. If missing equals -180
 * @apiParam {Number} [_end] Optional end time in minutes. If missing equals 1440
 * @apiParam {String[]} [channel_numbers] Optional channel number separated by comma
 *
 *@apiDescription Copy paste this auth for testing purposes
 *auth=/ihCuMthnmY7pV3WLgC68i70zwLp6DUrLyFe9dOUEkxUBFH9WrUcA95GFAecSJH9HG9tvymreMOFlBviVd3IcII4Z/SiurlGoz9AMtE5KGFZvCl1FQ3FKZYP3LeFgzVs\r\nDQjxaup3sKRljj4lmKUDTA==
 *
 */


exports.get_epg_data_with_images = async function (req, res) {
  const schema = Joi.object().keys({
    _start: Joi.number().integer().default(-180),
    _end: Joi.number().integer().default(1440),
    channel_numbers: Joi.string().required()
  })

  const {error, value} = schema.validate(req.query);
  const {_start, _end, channel_numbers} = value;

  if (error) {
    return response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
  }

  const startTime = moment().add(_start, "minutes");
  const endTime = moment().add(_end, "minutes");

  const channelNumbers = channel_numbers.split(',');

  const attributes = ['id', 'channel_number', 'title'];
  const include = [{
    model: models.epg_data,
    attributes: ['id', 'title', 'short_name', 'short_description', 'long_description', 'program_start', 'program_end', 'duration_seconds', 'long_description'],
    required: false,
    where: Sequelize.and(
      {company_id: req.thisuser.company_id},
      Sequelize.or(
        Sequelize.and(
          {program_start:{[Op.gte]:startTime}},
          {program_start:{[Op.lte]:endTime}}
        ),
        Sequelize.and(
          {program_end: {[Op.gte]:startTime}},
          {program_end:{[Op.lte]:endTime}}
        )
      )
    ),
    include: [{
      model: models.program_schedule,
      attributes: ['id'],
      required: false,
      where: {login_id: req.thisuser.id}
    }]
  }];

  const final = {
    attributes,
    where: {
      channel_number: {[Op.in]: channelNumbers}
    },
    include
  }

  const epg = await models.channels.findAll(final);

  for (let i = 0; i < epg.length; i++) {
    for (let j = 0; j < epg[i].dataValues.epg_data.length; j++) {
      const currentEpgData = epg[i].dataValues.epg_data[j].dataValues;
      epg[i].dataValues.epg_data[j].dataValues.program_image_url = await getImagePerProgram(currentEpgData.title, epg[i].dataValues.id, req);
    }
  }
  response.send_res_get(req, res, epg, 200, -1, 'OK_DESCRIPTION', 'OK_DATA');
};

/**
 * @api {get} /apiv2/channels/scheduled Get Scheduled Programs
 * @apiVersion 0.3.0
 * @apiName GetScheduledPrograms
 * @apiGroup EPG
 *
 * @apiHeader {String} auth Authorization
 * @apiDescription Get scheduled programs
 * @apiSuccessExample Success-Response:
 * HTTP/1.1 200 OK
 * {
 *     "status_code": 200,
 *     "error_code": 1,
 *     "timestamp": 1,
 *     "error_description": "OK",
 *     "extra_data": "",
 *     "response_object": [
 *         337934,
 *         337944
 *     ]
 * }
 * @apiErrorExample Error-Response:
 *  HTTP/1.1 200 OK
 *  {
 *     "status_code": 706,
 *     "error_code": -1,
 *     "timestamp": 1,
 *     "extra_data": "DATABASE_ERROR_DATA",
 *     "response_object": []
 *  }
 * 
 */
exports.getScheduledPrograms = async function(req, res) {
  try {
    let result = await models.program_schedule.findAll({
      attributes: ['id'],
      where: {
        login_id: req.thisuser.id
      },
      include: [
        {
          model: models.epg_data,
          required: true,
          attributes: ['id'],
          where: {
            program_start: {
              [Op.gte]: new Date()
            }
          }
        }
      ]
    });

    let scheduledPrograms = [];
    if (result.length > 0) {
      let scheduleCheckPromises = [];
      for (let i = 0; i < result.length; i++) {
        let promise = new Promise(function(resolve, reject) {
          let programSchedule = result[i];
          schedule.isScheduledPromise(programSchedule.id)
            .then(function(isScheduled) {
              if (isScheduled) {
                scheduledPrograms.push(programSchedule.epg_datum.id);
              }

              resolve();
            })
            .catch(function(err) {
              reject(err);
            });
        });

        scheduleCheckPromises.push(promise);
      }

      await Promise.all(scheduleCheckPromises);
    }
    
    response.send_res(req, res, scheduledPrograms, 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'no-store');
  }
  catch(err) {
    winston.error('Retrieving list of scheduled programs failed with error ' + err);
    response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
  }
}