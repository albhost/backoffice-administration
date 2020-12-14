'use strict';

const path = require('path'),
  errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller')),
  winston = require('winston'),
  models = require(path.resolve('./config/lib/sequelize')).models,
  Joi = require('joi');

// check if a default player is set to a specific platform
const checkDefaultPlayer = async(platformId, companyId) => {
  try {
    const existDefault = await models.media_player.findOne({
      where: {
        app_id: platformId,
        company_id: companyId,
        default: true
      }
    });
  
    if (existDefault) {
      return Promise.resolve(true);
    }
    return Promise.resolve(false);
  } catch (error) {
    return Promise.reject(error);
  }
}

// check if a player is already added for a platform, prevent adding same player
const doesPlayerExist = async(playerName, platformId, companyId) => {
  try {
    const playerExist = await models.media_player.findOne({
      where: {
        player_name: playerName,
        app_id: platformId,
        company_id: companyId
      }
    });
  
    if (playerExist) {
      return Promise.resolve(true);
    }
    return Promise.resolve(false);
  } catch (error) {
    return Promise.reject(error);
  }
}

// check if a platform exist before adding a player for it
const checkPlatform = async(platformId) => {
  try {
    const appIdExist = await models.app_group.findByPk(platformId);
    if (appIdExist) {
      return Promise.resolve(true);
    }
    return Promise.resolve(false);
  } catch (error) {
    return Promise.reject(error);
  }
}
/**
 * @api {post} /api/mediaplayer CreateMediaPlayer
 * @apiVersion 1.0.0
 * @apiName CreateMediaPlayer
 * @apiGroup MediaPlayer
 * 
 * @apiHeader {String} Authorization Token string acquired from login api.
 * @apiParam {String} player_name Player name .
 * @apiParam {Number} app_id App id refers to the platform used.
 * @apiParam {Boolean} default Default media player for that platform
 * 
 * @apiSuccess (200) {Object} object Media player data stored on the database
 * @apiError (4xx) {String} message Error message on creating madial player data.
 * @apiError (5xx) {String} message Error message on creating madial player data.
 *
 * @apiSuccessExample Success-Response:
 *   HTTP/1.1 200 OK
 *  {
 *      "id": "number",
 *      "company_id": "number",
 *      "player_name": "string",
 *      "app_id": "string"
 *      "default": "boolean",
 *      "createdAt": "Date",
 *      "updatedAt": "Date",
 *  }
 *     
 * @apiErrorExample Error-Response:
 *  HTTP/1.1 400 Bad Request
 *   {
 *      message: 'string message of the error'
 *   }
 * 
 */
exports.create = async (req, res) => {
  try {
    const schema = Joi.object().keys({
      player_name: Joi.string().required().lowercase().trim(),
      app_id: Joi.number().integer().required(),
      default: Joi.boolean()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      winston.error("Media player data are not correct: ", error.message);
      return res.status(400).send({ message: errorHandler.getErrorMessage(error) });
    }

    const appIdExist = await checkPlatform(value.app_id);
    if (!appIdExist) {
      return res.status(400).send({ message: 'Platform(app_id) does not exist!' });
    }

    if (value.default) {
      const existDefault = await checkDefaultPlayer(value.app_id, req.token.company_id)
      if (existDefault) {
        return res.status(400).send({ message: 'Default player is set for this platform!' });
      }
    }

    const playerExist = await doesPlayerExist(value.player_name, value.app_id, req.token.company_id)
    if (playerExist) {
      return res.status(400).send({ message: 'Player exist on this platform!' });
    }

    value.company_id = req.token.company_id; //save record of logged user company
    let result = await models.media_player.create(value)
    if (!result) {
      return res.status(400).send({ message: 'Failed to create media player!' });
    }

    res.json(result);
  } catch (err) {
    winston.error('Creating media player failed with error: ', err);
    res.status(500).send({ message: errorHandler.getErrorMessage(err) });
  }
};

/**
 * @api {get} /api/mediaplayer/:id MediaPlayerData
 * @apiVersion 1.0.0
 * @apiName GetMediaPlayer
 * @apiGroup MediaPlayer
 *
 * @apiHeader {String} Authorization Token string acquired from login api.
 * @apiDescription Retrieve the data of one MediaPlayer.
 * 
 * @apiError (Error 4xx) {Object} error Error
 * @apiError {String} error.message Message description of error
 * 
 * @apiError (Error 5xx) {Object} error Error
 * @apiError {String} error.name Name of error
 * @apiError {String} error.message Message description of error
 * 
 * @apiSuccessExample Success-Response:
 *   HTTP/1.1 200 OK
 *  {
 *      "id": "number",
 *      "company_id": "number",
 *      "player_name": "string",
 *      "app_id": "number",
 *      "default": "boolean"
 *      "createdAt": "2020-07-09T12:45:11.000Z",
 *      "updatedAt": "2020-07-09T12:45:11.000Z"
 *  }
 *     
 * @apiErrorExample Error-Response:
 *  HTTP/1.1 400 Bad Request
 *   {
 *      message: 'The media player id is required and must be a number!'
 *   }
 * 
 * @apiErrorExample Error-Response:
 *  HTTP/1.1 404 Not found
 *   {
 *      message: 'No data with that identifier has been found'
 *   }
 * 
 */
exports.read = function (req, res) {
  res.json(req.mediaPlayer);
};

/**
 * @api {put} /api/mediaplayer/:id UpdateMediaPlayer
 * @apiVersion 1.0.0
 * @apiName UpdateMediaPlayerData
 * @apiGroup MediaPlayer
 *
 * @apiHeader {String} Authorization Token string acquired from login api.
 * @apiDescription Retrieve the data of one MediaPlayer.
 * 
 * @apiError (Error 4xx) {Object} error Error
 * @apiError {String} error.message Message description of error
 * 
 * @apiError (Error 5xx) {Object} error Error
 * @apiError {String} error.name Name of error
 * @apiError {String} error.message Message description of error
 * 
 * @apiSuccessExample Success-Response:
 *   HTTP/1.1 200 OK
 *  {
 *      "id": "number",
 *      "company_id": "number",
 *      "player_name": "string",
 *      "app_id": "number",
 *      "default": "boolean"
 *      "createdAt": "2020-07-09T12:45:11.000Z",
 *      "updatedAt": "2020-07-09T12:45:11.000Z",
 *  }
 *     
 * @apiErrorExample Error-Response:
 *  HTTP/1.1 400 Bad Request
 *   {
 *      message: 'The carousel id is required and must be a number!'
 *   }
 * 
 * @apiErrorExample Error-Response:
 *  HTTP/1.1 404 Not found
 *   {
 *      message: 'No data with that identifier has been found'
 *   }
 * 
 */
exports.update = async (req, res) => {
  try {
    const schema = Joi.object().keys({
      player_name: Joi.string().required(),
      app_id: Joi.number().integer().required(),
      default: Joi.boolean()
    });
    const { error, value } = schema.validate(req.body);
    if (error) {
      winston.error("Media player data are not correct: ", error.message);
      return res.status(400).send({ message: errorHandler.getErrorMessage(error) });
    }

    const appIdExist = await checkPlatform(value.app_id);
    if (!appIdExist) {
      return res.status(400).send({ message: 'Platform(app_id) does not exist!' });
    }

    if (value.default) {
      const existDefault = await checkDefaultPlayer(value.app_id, req.token.company_id)
      if (existDefault) {
        return res.status(400).send({ message: 'Default player is set for this platform!' });
      }
    }

    const playerExist = await doesPlayerExist(value.player_name, value.app_id, req.token.company_id)
    if (playerExist) {
      return res.status(400).send({ message: 'Player exist on this platform!' });
    }

    let result = await req.mediaPlayer.update(value)
    res.json(result);
  } catch (err) {
    winston.error("Updating banner failed with error: ", err);
    return res.status(500).send({ message: errorHandler.getErrorMessage(err) });
  }
};


/**
 * @api {delete} /api/mediaplayer/:id DeleteMediaPlayerData
 * @apiVersion 1.0.0
 * @apiName DeleteMediaPlayerData
 * @apiGroup MediaPlayer
 *
 * @apiHeader {String} Authorization Token string acquired from login api.
 * @apiDescription Retrieve the data of one MediaPlayer.
 * 
 * @apiError (Error 4xx) {Object} error Error
 * @apiError {String} error.message Message description of error
 * 
 * @apiError (Error 5xx) {Object} error Error
 * @apiError {String} error.name Name of error
 * @apiError {String} error.message Message description of error
 * 
 * @apiSuccessExample Success-Response:
 *   HTTP/1.1 200 OK
 *  {
 *      "id": "number",
 *      "company_id": "number",
 *      "player_name": "string",
 *      "app_id": "number",
 *      "default": "boolean"
 *      "createdAt": "2020-07-09T12:45:11.000Z",
 *      "updatedAt": "2020-07-09T12:45:11.000Z"
 *  }
 *     
 * @apiErrorExample Error-Response:
 *  HTTP/1.1 400 Bad Request
 *   {
 *      message: 'The carousel id is required and must be a number!'
 *   }
 * 
 * @apiErrorExample Error-Response:
 *  HTTP/1.1 404 Not found
 *   {
 *      message: 'No data with that identifier has been found'
 *   }
 * 
 */
exports.delete = async (req, res) => {
  try {
    await req.mediaPlayer.destroy();
    res.json(req.mediaPlayer);
  } catch (err) {
    winston.error('Deleting media player failed with error: ', err);
    res.status(500).send({ message: errorHandler.getErrorMessage(err) });
  }
};

/**
 * @api {get} /api/mediaplayer MediaPlayerDataList
 * @apiVersion 1.0.0
 * @apiName MediaPlayerDataList
 * @apiGroup MediaPlayer
 *
 * @apiHeader {String} Authorization Token string acquired from login api.
 * @apiDescription Retrieve the MediaPlayer data.
 * 
 * @apiError (Error 4xx) {Object} error Error
 * @apiError {String} error.message Message description of error
 * 
 * @apiError (Error 5xx) {Object} error Error
 * @apiError {String} error.name Name of error
 * @apiError {String} error.message Message description of error
 * 
 * @apiSuccessExample Success-Response:
 *   HTTP/1.1 200 OK
 *     [
 *         {
 *           "id": "number",
 *           "company_id": "number",
 *           "player_name": "string",
 *           "app_id": "number",
 *           "default": "boolean",
 *           "createdAt": "2020-07-09T12:45:11.000Z",
 *           "updatedAt": "2020-07-09T12:45:11.000Z",
 *         },
 *         ... 
 *     ]
 *     
 * 
 * @apiErrorExample Error-Response:
 *  HTTP/1.1 404 Not found
 *   {
 *      message: 'No data found'
 *   }
 * 
 */
exports.list = async (req, res) => {
  try {
    let mediaPlayers = await models.media_player.findAndCountAll({
      where: {
        company_id: req.token.company_id
      }
    })

    if (!mediaPlayers.count) {
      return res.status(404).send({ message: 'No data found' });
    }

    res.setHeader("X-Total-Count", mediaPlayers.count);
    res.json(mediaPlayers.rows);
  } catch (err) {
    winston.error("Getting list of media player failed with error: ", err);
    res.status(500).json(err);
  }
};

/**
 * middleware
 */
exports.dataByID = async (req, res, next) => {
  try {
    const idParam = Joi.number().integer().required();
    const { error, value } = idParam.validate(req.params.id);
    if (error) {
      return res.status(400).send({ message: 'The media player id is required and must be a number!' });
    }

    let result = await models.media_player.findOne({
      where: { id: value, company_id: req.token.company_id }
    })
    if (!result) {
      return res.status(404).send({ message: 'No data with that identifier has been found' });
    }
    req.mediaPlayer = result;
    next();
  } catch (err) {
    winston.error("Getting media player failed with error: ", err);
    res.status(500).send({ message: errorHandler.getErrorMessage(err) });
  }
};
