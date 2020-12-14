'use strict'

const path = require('path'),
  db = require(path.resolve('./config/lib/sequelize')),
  models = db.models,
  response = require('../utils/response');
const winston = require('winston');
const Sequelize = require('sequelize');
const Joi = require('joi');
const schedule = require("../../../../config/lib/scheduler");
const moment = require("moment")
const { Op } = require('sequelize')
/**
 * @api {get} /apiv4/epg/data ChannelsEPGData
 * @apiVersion 4.0.0
 * @apiName EPGData
 * @apiGroup EPG
 *
 * @apiHeader {String} x-access-token Users JWT token.
 * @apiDescription Retrieve the EPG data for channels.
 * @apiParam {Number} [start]  Optional start time in minutes. If missing equals -180
 * @apiParam {Number} [end] Optional end time in minutes. If missing equals 1440
 * @apiParam {String[]} [channel_numbers] Optional channel number separated by comma
 * 
 *  @apiSuccessExample Success-Response:
 *   HTTP/1.1 200 OK
 *     {
 *       "data": [
 *         {
 *          "id": "number",
 *          "channel_number": "number",
 *          "title": "string",
 *          "icon_url": "string",
 *          "epg_data": [array]
 *         }
 *       ]
 *     }
 * 
 * @apiErrorExample Error-Response:
 *  HTTP/1.1 400 Bad Request
 *   {
 *      "error": {
 *         "code": 36,
 *         "message": "Bad Request"
 *      }
 *   }
 *
 * @apiErrorExample Error-Response:
 *  HTTP/1.1 500 Internal Server Error
 *   {
 *      "error": {
 *        "code": 51,
 *        "message": "Internal Error"
 *      }
 *   }
 * 
 */

exports.getEpgData = async (req, res) => {
  const schema = Joi.object().keys({
    start: Joi.number().integer().default(-180),
    end: Joi.number().integer().default(1440),
    channel_numbers: Joi.string()
  });

  const { error, value } = schema.validate(req.query);
  if (error) {
    winston.error("Data are not correct: ", error.message);
    return response.sendError(req, res, 400, 36);
  }

  const starttime = (Date.now() + value.start * 60000);
  const endtime = (Date.now() + value.end * 60000);

  let channelnumbers = [];
  if (value.channel_numbers) {
    channelnumbers = value.channel_numbers.toString().split(',');
  }

  let final_where = {};
  final_where.attributes = ['id', 'channel_number', 'title', [db.sequelize.fn("concat", req.app.locals.backendsettings[req.auth.company_id].assets_url, db.sequelize.col("channels.icon_url")), 'icon_url']],
    final_where.include = [{
      model: models.epg_data, attributes: ['id', 'title', 'short_name', 'short_description', 'long_description', 'program_start', 'program_end', 'duration_seconds', 'long_description'],
      required: false,
      where: Sequelize.and(
        { company_id: req.auth.company_id },
        Sequelize.or(
          Sequelize.and(
            { program_start: { [Op.gte]: starttime } },
            { program_start: { [Op.lte]: endtime } }
          ),
          Sequelize.and(
            { program_end: { [Op.gte]: starttime } },
            { program_end: { [Op.lte]: endtime } }
          )
        )
      ),
      include: [{ model: models.program_schedule, attributes: ['id'], required: false, where: { login_id: req.auth.id } }]
    }];

  if (channelnumbers.length > 0) final_where.where = { channel_number: { [Op.in]: channelnumbers } }; //limit data only for this list of channels

  final_where.order = ['channel_number'];

  models.channels.findAll(
    final_where
  ).then(result => {
    response.sendData(req, res, result);
  }).catch(error => {
    winston.error("Getting the events for a specific list of channels failed with error: ", error);
    response.sendError(req, res, 500, 51);
  });
};

/**
 * @api {get} /apiv4/catchup/data ChannelsCatchupData
 * @apiVersion 4.0.0
 * @apiName CatchupData
 * @apiGroup Catchup
 *
 * @apiHeader {String} x-access-token Users JWT token.
 * @apiDescription Retrieve the EPG data for channels.
 * @apiParam {Integer} [channelId] Required channel number separated by comma
 * @apiParam {Integer} [day] Optional channel number separated by comma
 *
 *  @apiSuccessExample Success-Response:
 *   HTTP/1.1 200 OK
 *     {
 *       "data": [
 *         {
 *          "id": "number",
 *          "channel_number": "number",
 *          "title": "string",
 *          "icon_url": "string",
 *          "epg_data": [array]
 *         }
 *       ]
 *     }
 *
 * @apiErrorExample Error-Response:
 *  HTTP/1.1 400 Bad Request
 *   {
 *      "error": {
 *         "code": 36,
 *         "message": "Bad Request"
 *      }
 *   }
 *
 * @apiErrorExample Error-Response:
 *  HTTP/1.1 500 Internal Server Error
 *   {
 *      "error": {
 *        "code": 51,
 *        "message": "Internal Error"
 *      }
 *   }
 *
 */
exports.getCatchupEpg =  async function (req, res) {
  const schema = Joi.object().keys({
    day: Joi.number().integer().default(0),
    channelId: Joi.string().required()
  })

  const {error, value} = schema.validate(req.query);
  const {day, channelId} = value;

  if (error) {
    winston.error("Data are not correct: ", error.message);
    return response.sendError(req, res, 400, 36);
  }

  const now = moment().subtract(day, "days")
  const startInterval = moment(now).set({hour: 0, minute: 0, second: 0, millisecond: 0})

  const endInterval = moment(now).set({hour: 23, minute: 59, second: 59, millisecond: 59})

  const epgData = await models.epg_data.findAll({
    attributes: ['id', 'title', 'short_description', 'short_name', 'duration_seconds', 'program_start', 'program_end', 'long_description'],
    order: [['program_start', 'ASC']],
    include: [
      {
        model: models.channels, required: true, attributes: ['title', 'channel_number'],
        where: {id: channelId, company_id: req.auth.data.company_id} //limit data only for this channel
      },
      {
        model: models.program_schedule,
        required: false, //left join
        attributes: ['id'],
        where: {login_id: req.user.id}
      }
    ],
    where: Sequelize.and(
      {company_id: req.auth.data.company_id},
      Sequelize.or(
        Sequelize.and(
          {program_start: {[Op.gte]: startInterval}},
          {program_start: {[Op.lte]: endInterval}}
        ),
        Sequelize.and(
          {program_end: {[Op.gte]: startInterval}},
          {program_end: {[Op.lte]: endInterval}}
        )
      )
    )
  });

  let final = [];

  for(let i = 0; i < epgData.length; i++) {
    const epg = epgData[i];
    const scheduled = (!epg.program_schedules[0]) ? false : await schedule.isScheduled(epg.program_schedules[0].id)
    final.push({
      channel_name: epg.channel.title,
      id: epg.id,
      title: epg.title,
      number: epg.channel.channel_number,
      scheduled: scheduled,
      description: epg.long_description,
      short_name: epg.short_description,
      program_start: moment(epg.program_start),
      program_end: moment(epg.program_end),
      duration: epg.duration_seconds,
    })
  }

  response.sendData(req, res, final);

};

/**
 * @api {get} /apiv4/catchup/stream Get Channels Catchup Stream
 * @apiName CatchupEvents
 * @apiGroup Channel
 * @apiVersion  4.0.0
 *
 * @apiParam {Number} channel_number Channel number
 * @apiParam {Number} start_at Unix timestamp where te stream should start.
 * @apiParam {Number} duration Duration of the programme in seconds, required in flussonic catchup stream.
 * @apiDescription Returns catchup stream url for the requested channel.
 * @apiHeader {String} x-access-token User JWT token.
 * @apiSuccess (Success 200) {Object} response Response
 * @apiSuccess {Object[]} response.data Catchup Stream
 * @apiSuccess {String} response.data.stream_url Stream URL
 * @apiSuccess {String} response.data.stream_format Stream format
 * @apiSuccess {String} response.data.drm_platform DRM platform
 * @apiSuccess {Bool}   response.data.token Token
 * @apiSuccess {String} response.data.token_url Token url
 * @apiSuccess {Bool}   response.data.encryption Encryption
 * @apiSuccess {String} response.data.encryption_url Encryption URL
 *
 * @apiSuccessExample Success-Response:
 *   HTTP/1.1 200 OK
 *     {
 *       "data": [
 *         {
 *           "stream_url": "http://akamaiauth.tibo.tv/topnewsit/timeshift_abs-81290-60.m3u8",
 *           "stream_format": "2",
 *           "drm_platform": "none",
 *           "token": true,
 *           "token_url": "https://backoffice.magoware.tv/apiv2/token/catchupakamaitokenv2/topnews",
 *           "encryption": false,
 *           "encryption_url": "0"
 *         }
 *       ]
 *     }
 *
 * @apiErrorExample Error-Response:
 *  HTTP/1.1 404 Not Found
 *   {
 *      "error": {
 *         "code": 61,
 *         "message": "Stream not found"
 *      }
 *   }
 *
 * @apiErrorExample Error-Response:
 *  HTTP/1.1 500 Internal Server Error
 *   {
 *      "error": {
 *        "code": 51,
 *        "message": "Internal Error"
 *      }
 *   }
 *
 */
exports.getCatchupStream = function (req, res) {
  const schema = Joi.object().keys({
    start_at: Joi.string().required(),
    channelId: Joi.number().integer().required(),
    duration: Joi.number().integer()
  });

  const { error, value } = schema.validate(req.query);
  if (error) {
    return response.sendError(req, res, 400, 36);
  }

  const stream_where = {
    stream_source_id: req.user.channel_stream_source_id, //get streams from source based on client preferences
    stream_mode: 'catchup', //get only catchup streams
    stream_resolution: { [Op.like]: "%" + req.auth.data.app_id + "%" } //get streams based on application type
  };

  models.channels.findOne({
    attributes: ['id'],
    include: [{ model: models.channel_stream, required: true, where: stream_where }],
    where: { id: value.channelId, company_id: req.auth.data.company_id }
  }).then(function (catchup_streams) {
    if (!catchup_streams) {
      return response.sendError(req, res, 500, 61);
    }

    let thestream = catchup_streams.channel_streams[0].stream_url;
    //check recording engine
    if (catchup_streams.channel_streams[0].recording_engine == 'wowza') {
      //milliseconds required for Date functions
      if(value.start_at.length === 10) {
        value.start_at = value.start_at * 1000;
      }
      let date = new Date(parseInt(value.start_at));

      let wtime = {};
      wtime.years = date.getFullYear();
      wtime.months = date.getUTCMonth() + 1;
      wtime.days = date.getUTCDate();
      wtime.hours = date.getUTCHours();
      wtime.minutes = date.getUTCMinutes();
      wtime.seconds = date.getUTCSeconds();

      let catchup_moment = date.getFullYear() + (("0" + wtime.months).slice(-2)) + (("0" + wtime.days).slice(-2)) + (("0" + wtime.hours).slice(-2)) + (("0" + wtime.minutes).slice(-2)) + "00";
      thestream = thestream.replace('[epochtime]', catchup_moment);

    } else if (catchup_streams.channel_streams[0].recording_engine === 'nimble_timeshift') {
      let nimble_timeshift;
      if (typeof value.start_at === 'string' && value.start_at.length === 10 ) {
        nimble_timeshift = parseInt(Date.now() / 1000) - value.start_at
      } else {
        nimble_timeshift = parseInt((Date.now() - value.start_at) / 1000);
      }
      thestream = thestream.replace('[shift]', nimble_timeshift);
    } else if (catchup_streams.channel_streams[0].recording_engine === 'nimble_dvr') {
      let depth;
      if ((Date.now() / 1000 - value.start_at) > 9000) {
          depth = '9000';
      }
      else {
          depth = 'now';
      }
      
      thestream = thestream.replace('[epochtime]', value.start_at).replace('[depth]', depth);
    } else {
      //assume it is flussonic
      //if timestamp is bigger than 2.5 ours

      // check if stream has index
      if (thestream.includes('index')) {
        if((Date.now()/1000 - value.start_at) > 9000) {
          thestream = thestream.replace('[epochtime]', value.start_at);
          thestream = thestream.replace('[depth]', `${value.duration}`);
        } else {
          thestream = thestream.replace('[epochtime]', value.start_at);
          thestream = thestream.replace('[depth]', 'now');
        }
      }
      // check if stream has timeshift_abs
      if (thestream.includes('timeshift_abs')) {
        thestream = thestream.replace('[epochtime]', value.start_at);
      }
    }

    const response_data = [{
      stream_url: thestream, //catchup_streams.channel_streams[0].stream_url.replace('[epochtime]', value.start_at)
      stream_format: catchup_streams.channel_streams[0].stream_format,
      drm_platform: catchup_streams.channel_streams[0].drm_platform,
      token: catchup_streams.channel_streams[0].token,
      token_url: catchup_streams.channel_streams[0].token_url,
      encryption: catchup_streams.channel_streams[0].encryption,
      encryption_url: catchup_streams.channel_streams[0].encryption_url
    }];

    response.sendData(req, res, response_data);
  }).catch(function (error) {
    winston.error("Getting list of genres/categories failed with error: ", error);
    response.sendError(req, res, 500, 51);
  });
};