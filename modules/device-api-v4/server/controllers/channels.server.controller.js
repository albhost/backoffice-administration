'use strict'

const path = require('path'),
  db = require(path.resolve('./config/lib/sequelize')),
  models = db.models,
  response = require('../utils/response'),
  winston = require('winston'),
  streamStore = require(path.resolve('./config/lib/stream_store'));

const Joi = require("joi")
const {Op} = require('sequelize');
const moment = require("moment")

/**
 * @api {get} /apiv4/channel/:id Get Channel Details
 * @apiName Channel Details
 * @apiGroup Channel
 * @apiVersion  4.0.0
 *
 * @apiDescription Retrieve information for all the channels.
 * @apiHeader {String} x-access-token Users JWT token.
 * @apiSuccess (Success 200) {Object} response Response
 * @apiSuccess (Success 204) {Object} response Response empty array
 *  @apiSuccessExample Success-Response:
 *   HTTP/1.1 200 OK
 {
    "data": {
        "icon_url": "http://rc.tibo.tvhttp://rc.tibo.tvtibo-image-files/1/file/channels/1601543872689TopChannel.png",
        "pin_protected": false,
        "channel_number": 2,
        "title": "Top Channel HD",
        "stream": {
            "stream_source_id": 2,
            "channel_mode": "catchup",
            "stream_format": "2",
            "has_token": true,
            "token_url": "https://drmkey.tibo.tv/apiv2/token/akamaitokenv2nimble/bbb",
            "has_encryption": false,
            "encryption_url": null,
            "drm_platform": "none"
        }
    }
}
 *
 * @apiErrorExample Error-Response:
 *  HTTP/1.1 404 Not Found
 *   {
 *      "error": {
 *         "code": 6,
 *         "message": "Channel not found"
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
exports.getChannel = async function (req, res) {
  const settings = req.app.locals.backendsettings[req.auth.company_id]

  const schema = Joi.number().integer().required()

  const {error, value: channelId} = schema.validate(req.params.id);

  if (error) {
    return response.sendError(req, res, 400, 60)
  }
  try {
    const streamWhere = {
      stream_source_id: req.user.channel_stream_source_id,
      stream_mode: 'live',
      stream_resolution: {[Op.like]: "%" + req.auth.data.app_id + "%"}
    }

    const channel = await models.channels.findOne({
      attributes: ['id', 'genre_id', 'channel_number', 'title', [db.sequelize.fn('concat', settings.assets_url, db.sequelize.col('channels.icon_url')), 'icon_url'], 'pin_protected', 'catchup_mode'],
      where: {id: channelId},
      include: [
        {
          model: models.genre,
          attributes: ['id', 'description', 'is_available', 'pin_protected', [db.sequelize.fn('concat', settings.assets_url, db.sequelize.col('genre.icon_url')), 'icon_url']]
        },
        {
          model: models.channel_stream,
          required: true,
          attributes: ['stream_source_id', 'stream_url', 'stream_format', 'token', 'token_url', 'drm_platform', 'encryption', 'encryption_url', 'thumbnail_url'],
          where: streamWhere
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
              where: {package_type_id: req.auth.data.screensize},
              include: [
                {
                  model: models.subscription,
                  required: true,
                  attributes: [],
                  where: {login_id: req.user.id, end_date: {[Op.gte]: Date.now()}}
                }
              ]
            }
          ]
        },
        {model: models.favorite_channels,
          required: false,
          attributes: ['id'],
          where: {user_id: req.user.id}
        }
      ]
    });
    const channelStream = channel.channel_streams[0];
    const isFavorite = channel.favorite_channels.length > 0;

    const finalChannel = {
      id: channel.id,
      icon_url: settings.assets_url + channel.icon_url,
      pin_protected: channel.pin_protected,
      channel_number: channel.channel_number,
      title: channel.title,
      is_favorite_channel: isFavorite,
      stream: {
        channel_mode: channel.catchup_mode ? 'catchup' : 'live',
        stream_format: channelStream.stream_format,
        stream_url: channelStream.stream_url,
        has_token: channelStream.token,
        token_url: channelStream.token_url,
        has_encryption: channelStream.encryption,
        encryption_url: channelStream.encryption_url,
        thumbnail_url: channelStream.thumbnail_url,
        drm_platform: channelStream.drm_platform,
      }
    }

    response.sendData(req, res, finalChannel);
  } catch (e) {
    response.sendError(req, res, 500, 51);
  }
}

/**
 * @api {get} /apiv4/channel/list Get Channel list
 * @apiName Channel list
 * @apiGroup Channel
 * @apiVersion  4.0.0
 *
 * @apiDescription Retrieve information for all the channels.
 * @apiHeader {String} x-access-token Users JWT token.
 * @apiSuccess (Success 200) {Object} response Response
 * @apiSuccess (Success 204) {Object} response Response empty array
 * @apiSuccess {Object[]} response.data List of channels
 * @apiSuccess {Number} response.data.id Id
 * @apiSuccess {Number} response.data.genre_id Genre id
 * @apiSuccess {Number} response.data.channel_number Channel number
 * @apiSuccess {String} response.data.title Title
 * @apiSuccess {String} response.data.icon_url Icon url
 * @apiSuccess {Bool}   response.data.pin_protected Pin protection status
 * @apiSuccess {Number} response.data.catchup_mode Catchup mode status
 * @apiSuccess {Number} response.data.stream_source_id Stream source
 * @apiSuccess {String} response.data.stream_url Stream url
 * @apiSuccess {String} response.data.channel_mode Channel mode
 * @apiSuccess {String} response.data.stream_format Stream format
 * @apiSuccess {Number} response.data.token Token
 * @apiSuccess {String} response.data.token_url URL of token
 * @apiSuccess {Number} response.data.encryption Encryption status
 * @apiSuccess {String} response.data.encryption_url Encryption url
 * @apiSuccess {String} response.data.drm_platform DRM platform
 * @apiSuccess {Number} response.data.is_octoshape Octoshape
 * @apiSuccess {String} response.data.favorite_channel Favorite channel
 *
 *  @apiSuccessExample Success-Response:
 *   HTTP/1.1 200 OK
 *     {
 *       "data": [
 *         {
 *          "id": "number",
 *          "genre_id": "number",
 *          "channel_number": "number",
 *          "title": "string",
 *          "icon_url": "string",
 *          "pin_protected": "boolean",
 *          "catchup_mode": "number",
 *          "stream_source_id": "number",
 *          "stream_url": "string",
 *          "channel_mode": "string",
 *          "stream_format": "string",
 *          "token": "number",
 *          "token_url": "string",
 *          "encryption": "number",
 *          "encryption_url": "string",
 *          "drm_platform": "string",
 *          "is_octoshape": "number",
 *          "favorite_channel": "string",
 *         }
 *       ]
 *     }
 *
 * @apiErrorExample Error-Response:
 *  HTTP/1.1 404 Not Found
 *   {
 *      "error": {
 *         "code": 6,
 *         "message": "Channel not found"
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
exports.getChannelList = async (req, res) => {
  const settings = req.app.locals.backendsettings[req.user.company_id];

  let where = {
    isavailable: true,
    company_id: req.user.company_id
  }

  if (req.user.show_adult === false) where.pin_protected = false;

  const pageLength = 60;

  const schema = Joi.object().keys({
    page: Joi.number().integer().default(1)
  });

  const {error, value} = schema.validate(req.query);
  const {page} = value;

  if (error) {
    return response.sendError(req, res, 400, 60)
  }

  try {
    const streamWhere = {
      stream_source_id: req.user.channel_stream_source_id,
      stream_mode: 'live',
      stream_resolution: {[Op.like]: `%${req.auth.data.app_id}%`}
    }

    const channels = await models.channels.findAndCountAll({
      attributes: ['id', 'genre_id', 'channel_number', 'title', 'icon_url', 'pin_protected'],
      where: where,
      subQuery: false,
      include: [
        {
          model: models.channel_stream,
          required: true,
          attributes: [],
          where: streamWhere
        },
        {model: models.genre, required: true, attributes: [], where: {is_available: true}},
        {
          model: models.packages_channels,
          required: true,
          attributes: [],
          include: [
            {
              model: models.package,
              required: true,
              attributes: [],
              where: {package_type_id: req.auth.data.screensize},
              include: [
                {
                  model: models.subscription,
                  required: true,
                  attributes: [],
                  where: {login_id: req.user.id, end_date: {[Op.gte]: Date.now()}}
                }
              ]
            }
          ]
        },
        {
          model: models.favorite_channels,
          required: false,
          attributes: ['id'],
          where: {user_id: req.user.id}
        }
      ],
      order: [['channel_number', 'ASC']],
      offset: (page - 1) * pageLength,
      limit: pageLength
    })

    if (channels.count <= 0) {
      return response.sendError(req, res, 204, 6);
    }

    let channelsFinal = channels.rows.map(channel => ({
      id: channel.id,
      genre_id: channel.genre_id,
      channel_number: channel.channel_number,
      title: channel.title,
      icon_url: settings.assets_url + channel.icon_url,
      pin_protected: channel.pin_protected != 0,
      favorite_channel: channel.favorite_channels.length > 0
    }))

    const channelList = {
      page: page,
      total_results: channels.count,
      total_pages: Math.ceil(channels.count / pageLength),
      results: channelsFinal
    };

    response.sendData(req, res, channelList);
  } catch (e) {
    response.sendError(req, res, 500, 51);
  }
}

/**
 * @api {get} /apiv4/channel/search Search Channels
 * @apiName Search Channels
 * @apiGroup Channel
 * @apiVersion  4.0.0
 *
 * @apiDescription Retrieve information for all the channels.
 * @apiHeader {String} x-access-token Users JWT token.
 * @apiSuccess (Success 200) {Object} response Response
 * @apiSuccess (Success 204) {Object} response Response empty array
 * @apiSuccess {Object[]} response.data List of channels
 * @apiSuccess {Number} response.data.id Id
 * @apiSuccess {Number} response.data.genre_id Genre id
 * @apiSuccess {Number} response.data.channel_number Channel number
 * @apiSuccess {String} response.data.title Title
 * @apiSuccess {String} response.data.icon_url Icon url
 * @apiSuccess {Bool}   response.data.pin_protected Pin protection status
 * @apiSuccess {Number} response.data.catchup_mode Catchup mode status
 * @apiSuccess {Number} response.data.stream_source_id Stream source
 * @apiSuccess {String} response.data.stream_url Stream url
 * @apiSuccess {String} response.data.channel_mode Channel mode
 * @apiSuccess {String} response.data.stream_format Stream format
 * @apiSuccess {Number} response.data.token Token
 * @apiSuccess {String} response.data.token_url URL of token
 * @apiSuccess {Number} response.data.encryption Encryption status
 * @apiSuccess {String} response.data.encryption_url Encryption url
 * @apiSuccess {String} response.data.drm_platform DRM platform
 * @apiSuccess {Number} response.data.is_octoshape Octoshape
 * @apiSuccess {String} response.data.favorite_channel Favorite channel
 *
 *  @apiSuccessExample Success-Response:
 *   HTTP/1.1 200 OK
 *     {
 *       "data": [
 *         {
 *          "id": "number",
 *          "genre_id": "number",
 *          "channel_number": "number",
 *          "title": "string",
 *          "icon_url": "string",
 *          "pin_protected": "boolean",
 *          "catchup_mode": "number",
 *          "stream_source_id": "number",
 *          "stream_url": "string",
 *          "channel_mode": "string",
 *          "stream_format": "string",
 *          "token": "number",
 *          "token_url": "string",
 *          "encryption": "number",
 *          "encryption_url": "string",
 *          "drm_platform": "string",
 *          "is_octoshape": "number",
 *          "favorite_channel": "string",
 *         }
 *       ]
 *     }
 *
 * @apiErrorExample Error-Response:
 *  HTTP/1.1 404 Not Found
 *   {
 *      "error": {
 *         "code": 6,
 *         "message": "Channel not found"
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
exports.searchChannels = async (req, res) => {
  const settings = req.app.locals.backendsettings[req.user.company_id];



  if (req.user.show_adult === false) where.pin_protected = false;

  const pageLength = 60;

  const querySchema = Joi.string().required();

  const {error, value: query} = querySchema.validate(req.query.q);

  if (error) {
    return response.sendError(req, res, 400, 60)
  }

  let where = {
    isavailable: true,
    company_id: req.user.company_id,
    title: {
      [Op.like]: `%${query}%`
    }
  }

  try {
    const streamWhere = {
      stream_source_id: req.user.channel_stream_source_id,
      stream_mode: 'live',
      stream_resolution: {[Op.like]: `%${req.auth.data.app_id}%`}
    }

    const channels = await models.channels.findAndCountAll({
      attributes: ['id', 'genre_id', 'channel_number', 'title', 'icon_url', 'pin_protected'],
      where: where,
      subQuery: false,
      include: [
        {
          model: models.channel_stream,
          required: true,
          attributes: [],
          where: streamWhere
        },
        {model: models.genre, required: true, attributes: [], where: {is_available: true}},
        {
          model: models.packages_channels,
          required: true,
          attributes: [],
          include: [
            {
              model: models.package,
              required: true,
              attributes: [],
              where: {package_type_id: req.auth.data.screensize},
              include: [
                {
                  model: models.subscription,
                  required: true,
                  attributes: [],
                  where: {login_id: req.user.id, end_date: {[Op.gte]: Date.now()}}
                }
              ]
            }
          ]
        },
        {
          model: models.favorite_channels,
          required: false,
          attributes: ['id'],
          where: {user_id: req.user.id}
        }
      ],
      order: [['channel_number', 'ASC']],
      limit: pageLength
    })

    if (channels.count <= 0) {
      return response.sendError(req, res, 204, 6);
    }

    let channelsFinal = channels.rows.map(channel => ({
      id: channel.id,
      genre_id: channel.genre_id,
      channel_number: channel.channel_number,
      title: channel.title,
      icon_url: settings.assets_url + channel.icon_url,
      pin_protected: channel.pin_protected != 0,
      favorite_channel: channel.favorite_channels.length > 0
    }))

    response.sendData(req, res, channelsFinal);
  } catch (e) {
    response.sendError(req, res, 500, 51);
  }
}

/**
 * @api {POST} /apiv4/channel/favorite Add a channel as a favorite
 * @apiVersion 4.0.0
 * @apiName AddFavoriteChannel
 * @apiGroup VOD_V4
 *
 * @apiHeader {String} x-access-token Users JWT token.
 * @apiDescription Add a movie as a favorite channel.
 * @apiParam {String} [channelId] Channel ID in body
 *
 *@apiDescription Add a movie as a favorite channel.
 *
 * @apiSuccessExample Success-Response:
 *   HTTP/1.1 200 OK
 {
    "data": true
}
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

/**
 * @api {DELETE} /apiv4/channel/favorite Remove a channel as a favorite.
 * @apiVersion 4.0.0
 * @apiName DeleteFavoriteChannel
 * @apiGroup VOD_V4
 *
 * @apiHeader {String} x-access-token Users JWT token.
 * @apiDescription Add a movie as a favorite channel.
 * @apiParam {String} [channelId] Channel ID in body
 *
 *@apiDescription Add a movie as a favorite channel.
 *
 * @apiSuccessExample Success-Response:
 *   HTTP/1.1 200 OK
 {
    "data": true
}
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
exports.favoriteChannel = async (req, res) => {
  const action = req.method === "POST";
  const companyId = req.user.company_id;

  const schema = Joi.number().integer().required();

  const {error, value: channelId} = schema.validate(req.body.channelId);
  if (error) {
    return response.sendError(req, res, 400, 60)
  }

  try {
    if (action) {
      const favoriteChannels = await models.favorite_channels.findOrCreate({
        where: {
          channel_id: channelId,
          user_id: req.user.id,
          company_id: companyId
        }
      })
    } else {
      const favoriteChannels = await models.favorite_channels.destroy({
        where: {
          channel_id: channelId,
          user_id: req.user.id,
          company_id: companyId
        }
      })
    }

    response.sendData(req, res, true);

  } catch (e) {
    winston.error("Error at favorite channels apiv4: ", e);
    response.sendError(req, res, 500, 51);
  }

}

/**
 * @api {GET} /apiv4/channel/osd Get current and next epg
 * @apiName osd
 * @apiVersion 4.0.0
 * @apiGroup DeviceAPI
 * @apiParam {String} [channel_number] Channel number parameter in url
 * @apiParam (Query param) {Number} channelNumber Channel number
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
exports.getOsdEpg = async function (req, res) {
  const companyId = req.user.company_id;
  const schema = Joi.number().required();
  const {error, value: channelNumber} = schema.validate(req.query.channel_number);

  if (error) {
    return response.sendError(req, res, 400, 60);
  }

  const intervalStart = moment();
  const intervalEnd = moment().add(12, "hours");

  const channel = await models.channels.findOne({
    where: {company_id: companyId, channel_number: channelNumber}
  })

  if (!channel) {
    return response.sendError(req, res, 404, 6)
  }

  const epgList = await models.epg_data.findAll({
    attributes: ['id', 'title', 'short_name', 'short_description', 'long_description', 'program_start', 'program_end', 'duration_seconds'],
    where: {
      company_id: companyId,
      program_start: {
        [Op.lte]: intervalEnd.toDate()
      },
      program_end: {
        [Op.and]: [
          {[Op.lte]: intervalEnd.toDate()},
          {[Op.gte]: intervalStart.toDate()}
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
  })

  const needCache = epgList.length !== 0;

  if (needCache) {
    const cacheDuration = Math.round(moment(epgList[epgList.length - 1].program_end).diff(moment()));
    return response.sendData(req, res, epgList, 'private,max-age=' + cacheDuration);
  }

  return response.sendData(req, res, epgList);
};


/**
 * @api {get} /apiv4/channel/favorites/list Get Favorite Channels list
 * @apiName Favorite Channel list
 * @apiGroup Channel
 * @apiVersion  4.0.0
 *
 * @apiDescription Retrieve information for all the channels.
 * @apiHeader {String} x-access-token Users JWT token.
 * @apiSuccess (Success 200) {Object} response Response
 * @apiSuccess (Success 204) {Object} response Response empty array
 * @apiSuccess {Object[]} response.data List of channels
 * @apiSuccess {Number} response.data.id Id
 * @apiSuccess {Number} response.data.genre_id Genre id
 * @apiSuccess {Number} response.data.channel_number Channel number
 * @apiSuccess {String} response.data.title Title
 * @apiSuccess {String} response.data.icon_url Icon url
 * @apiSuccess {Bool}   response.data.pin_protected Pin protection status
 * @apiSuccess {Number} response.data.catchup_mode Catchup mode status
 * @apiSuccess {Number} response.data.stream_source_id Stream source
 * @apiSuccess {String} response.data.stream_url Stream url
 * @apiSuccess {String} response.data.channel_mode Channel mode
 * @apiSuccess {String} response.data.stream_format Stream format
 * @apiSuccess {Number} response.data.token Token
 * @apiSuccess {String} response.data.token_url URL of token
 * @apiSuccess {Number} response.data.encryption Encryption status
 * @apiSuccess {String} response.data.encryption_url Encryption url
 * @apiSuccess {String} response.data.drm_platform DRM platform
 * @apiSuccess {Number} response.data.is_octoshape Octoshape
 * @apiSuccess {String} response.data.favorite_channel Favorite channel
 *
 *  @apiSuccessExample Success-Response:
 *   HTTP/1.1 200 OK
 *     {
 *       "data": [
 *         {
            "id": 957,
            "channel_number": 1,
            "title": "Info Channel",
            "icon_url": "http://rc.tibo.tv/1/files/channels/1601644367582240pxApplelogo.png"
        }
 *       ]
 *     }
 *
 * @apiErrorExample Error-Response:
 *  HTTP/1.1 404 Not Found
 *   {
 *      "error": {
 *         "code": 6,
 *         "message": "Channel not found"
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
exports.getFavoriteChannelsList = async (req, res) => {
  const settings = req.app.locals.backendsettings[req.user.company_id];

  let where = {
    isavailable: true,
    company_id: req.user.company_id
  }

  if (req.user.show_adult === false) where.pin_protected = false;

  try {
    const streamWhere = {
      stream_source_id: req.user.channel_stream_source_id,
      stream_mode: 'live',
      stream_resolution: {[Op.like]: `%${req.auth.data.app_id}%`}
    }

    const channels = await models.channels.findAndCountAll({
      attributes: ['id', 'channel_number', 'title', 'icon_url'],
      where: where,
      subQuery: false,
      include: [
        {
          model: models.channel_stream,
          required: true,
          attributes: [],
          where: streamWhere
        },
        {model: models.genre, required: true, attributes: [], where: {is_available: true}},
        {
          model: models.packages_channels,
          required: true,
          attributes: [],
          include: [
            {
              model: models.package,
              required: true,
              attributes: [],
              where: {package_type_id: req.auth.data.screensize},
              include: [
                {
                  model: models.subscription,
                  required: true,
                  attributes: [],
                  where: {login_id: req.user.id, end_date: {[Op.gte]: Date.now()}}
                }
              ]
            }
          ]
        },
        {
          model: models.favorite_channels,
          required: true,
          attributes: ['id'],
          where: {user_id: req.user.id}
        }
      ],
      order: [['channel_number', 'ASC']],
    })

    if (channels.count <= 0) {
      return response.sendError(req, res, 204, 6);
    }

    let channelsFinal = channels.rows.map(channel => ({
      id: channel.id,
      channel_number: channel.channel_number,
      title: channel.title,
      icon_url: settings.assets_url + channel.icon_url
    }))

    response.sendData(req, res, channelsFinal);
  } catch (e) {
    response.sendError(req, res, 500, 51);
  }
}