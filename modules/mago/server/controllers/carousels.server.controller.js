'use strict';

const path = require('path'),
    errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller')),
    winston = require('winston'),
    models = require(path.resolve('./config/lib/sequelize')).models,
    Joi = require('joi');

/**
 * @api {post} /api/carousels CreateCarouselData
 * @apiVersion 0.2.0
 * @apiName CreateCarouselData
 * @apiGroup Carousels
 *
 * @apiHeader {String} Authorization Token string acquired from login api.
 * @apiParam {String} type  Field type to be used for retrieving APIs.
 * @apiParam {String} title  Field title to be displayed on Carousel.
 * @apiParam {Number} order_number  Field order_number that tell the order of carousels to be displayed on mobile.
 * @apiParam {Boolean} [is_available]  Field is_available that can handle display or not to the mobile for carousel, by default is true.
 *
 * @apiSuccess (200) {Object} object Carousels data stored on the database
 * @apiError (4xx) {String} message Error message on creating carousels data.
 * @apiError (5xx) {String} message Error message on creating carousels data.
 *
 * @apiSuccessExample Success-Response:
 *   HTTP/1.1 200 OK
 *  {
 *      "id": "number",
 *      "type": "string",
 *      "title": "string",
 *      "is_available": "boolean",
 *      "order_number": "number",
 *      "company_id": "number"
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
            type: Joi.string().required(),
            title: Joi.string().required(),
            is_available: Joi.boolean(),
            order_number: Joi.number().integer().required()
        });
        const {error, value} = schema.validate(req.body);
        if (error) {
            winston.error("Carousel data are not correct: ", error.message);
            return res.status(400).send({message: errorHandler.getErrorMessage(error)});
        }
        value.company_id = req.token.company_id; //save record for this company
        let result = await models.carousels.create(value)
        if (!result) {
            return res.status(400).send({message: 'Failed to create carousel!'});
        }

        res.json(result);
    } catch (err) {
        winston.error('Creating carousel failed with error: ', err);
        res.status(500).send({message: errorHandler.getErrorMessage(err)});
    }
};

/**
 * @api {get} /api/carousels/:id CarouselData
 * @apiVersion 0.2.0
 * @apiName CarouselData
 * @apiGroup Carousels
 *
 * @apiHeader {String} Authorization Token string acquired from login api.
 * @apiDescription Retrieve the data of one carousel.
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
 *      "type": "string",
 *      "title": "string",
 *      "is_available": "boolean",
 *      "order_number": "number",
 *      "createdAt": "2020-07-09T12:45:11.000Z",
 *      "updatedAt": "2020-07-09T12:45:11.000Z",
 *      "company_id": 1
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
exports.read = function (req, res) {
    res.json(req.carousel);
};

/**
 * @api {put} /api/carousels/:id UpdateCarouselData
 * @apiVersion 0.2.0
 * @apiName UpdateCarouselData
 * @apiGroup Carousels
 *
 * @apiHeader {String} Authorization Token string acquired from login api.
 * @apiDescription Retrieve the data of one carousel.
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
 *      "type": "string",
 *      "title": "string",
 *      "is_available": "boolean",
 *      "order_number": "number",
 *      "createdAt": "2020-07-09T12:45:11.000Z",
 *      "updatedAt": "2020-07-09T12:45:11.000Z",
 *      "company_id": 1
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
            id: Joi.number(),
            type: Joi.string(),
            title: Joi.string().required(),
            is_available: Joi.boolean(),
            order_number: Joi.number().integer(),
            createdAt: Joi.string(),
            updatedAt: Joi.string(),
            company_id: Joi.number()
        });

        const {error, value} = schema.validate(req.body);
        if (error) {
            winston.error("Carousel data are not correct: ", error.message);
            return res.status(400).send({message: errorHandler.getErrorMessage(error)});
        }

        let result = await req.carousel.update(value)
        res.json(result);
    } catch (err) {
        winston.error("Updating carousel data failed with error: ", err);
        return res.status(500).send({message: errorHandler.getErrorMessage(err)});
    }
};


/**
 * @api {dalete} /api/carousels/:id DeleteCarouselData
 * @apiVersion 0.2.0
 * @apiName DeleteCarouselData
 * @apiGroup Carousels
 *
 * @apiHeader {String} Authorization Token string acquired from login api.
 * @apiDescription Retrieve the data of one carousel.
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
 *      "type": "string",
 *      "title": "string",
 *      "is_available": "boolean",
 *      "order_number": "number",
 *      "createdAt": "2020-07-09T12:45:11.000Z",
 *      "updatedAt": "2020-07-09T12:45:11.000Z",
 *      "company_id": 1
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
        await req.carousel.destroy();
        res.json(req.carousel);
    } catch (err) {
        winston.error('Deleting carousel failed with error: ', err);
        res.status(500).send({message: errorHandler.getErrorMessage(err)});
    }
};

/**
 * @api {get} /api/carousels CarouselsDataList
 * @apiVersion 0.2.0
 * @apiName CarouselsDataList
 * @apiGroup Carousels
 *
 * @apiHeader {String} Authorization Token string acquired from login api.
 * @apiDescription Retrieve the Carousels data.
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
 *           "type": "string",
 *           "title": "string",
 *           "order_number": "number",
 *           "is_available": "boolean",
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
        let carousels = await models.carousels.findAndCountAll({
            attributes: ['id', 'type', 'title', 'order_number', 'is_available'],
            order: ['order_number']
        })
        if (!carousels) {
            return res.status(404).send({message: 'No data found'});
        }

        res.setHeader("X-Total-Count", carousels.count);
        res.json(carousels.rows);
    } catch (err) {
        winston.error("Getting list of carousels failed with error: ", err);
        res.status(500).json(err);
    }
};

/**
 * middleware
 */
exports.dataByID = async (req, res, next) => {
    try {
        const idParam = Joi.number().integer().required();
        const {error, value} = idParam.validate(req.params.id);
        if (error) {
            return res.status(400).send({message: 'The carousel id is required and must be a number!'});
        }

        let result = await models.carousels.findOne({
            where: {id: value, company_id: req.token.company_id},
        })
        if (!result) {
            return res.status(404).send({message: 'No data with that identifier has been found'});
        }
        req.carousel = result;
        next();
    } catch (err) {
        winston.error("Getting banners failed with error: ", err);
        res.status(500).send({message: errorHandler.getErrorMessage(err)});
    }
};

/**
 * @api {post} /api/carousels/channels/:id Add Channel ID to carousels
 * @apiVersion 0.3.0
 * @apiName AddChannelIdToCaousels
 * @apiGroup Carousels
 *
 * @apiDescription Add channel Id to live now and trending carousel
 *
 * @apiSuccessExample Success-Response:
 *   HTTP/1.1 200 OK
 *     {
 *       "status_code": 200,
 *       "error_code": 1,
 *       "timestamp": 1,
 *       "error_description": "OK",
 *       "extra_data": "OK_DATA",
 *       "response_object": [
 *          {
 *            "id": 1,
 *            "type": "feed_tv_trending",
 *            "channels_id": [ { id: 957 }, { id: 1520 } ],
 *            company_id: 1
 *          },
 *          ...
 *       ]
 *     }
 *
 *
 * @apiErrorExample Error-Response:
 *  HTTP/1.1 400 Bad Request
 *   {
 *      message: 'string message of the error'
 *   }
 *
 */
exports.addChannelId = async (req, res) => {
    try {
        const schema = Joi.object().keys({
            id: Joi.number(),
            carousel_type: Joi.string(),
            channel_id: Joi.array()
        });

        const {error, value} = schema.validate(req.body);


        if (error) {
            winston.error("Carousel channel data are not correct: ", error.message);
            return res.status(400).send({message: 'Carousel channel data are not correct'});
        }
        value.company_id = req.token.company_id; //save record for this company
        value.channel_id = value.channel_id.toString();

        const exists = await models.carousel_channels.findOne({
            where: {
                company_id: value.company_id,
                carousel_type: value.carousel_type
            }
        });

        let result;
        if (exists) {
            const allChannels = value.channel_id.toString()
            value.channel_id = allChannels;
            if (value.channel_id) {
                result = models.carousel_channels.update(value, {
                    where: {
                        company_id: value.company_id,
                        carousel_type: value.carousel_type
                    }
                })
            } else {
                const result = await models.carousel_channels.findOne({
                    where: {
                        company_id: req.token.company_id,
                        id: value.id,
                        carousel_type: value.carousel_type
                    }
                })
                if (result && (result.company_id === req.token.company_id)) {
                    result.destroy().then(function () {
                        return res.json(result);
                    }).catch(function (err) {
                        winston.error("Failed deleting channels, error: ", err);
                        res.status(400).send({
                            message: errorHandler.getErrorMessage(err)
                        });
                    });
                    return null;
                } else {
                    return res.status(400).send({
                        message: 'Unable to find the Data'
                    });

                }
            }
        } else {
            result = models.carousel_channels.create(value)
            if (!result) {
                return res.status(400).send({message: 'Failed to create carousel!'});
            }
        }

        res.json(result);

    } catch (err) {
        winston.error("Creating carousel channel data failed with error: ", err);
        return res.status(500).send({message: 'Creating carousel channel data failed with error:'});
    }
};


/**
 * @api {get} /api/carousels/channels/:id GetSelectedChannels
 * @apiVersion 0.2.0
 * @apiName GetSelectedChannels
 * @apiGroup Carousels
 *
 * @apiHeader {String} Authorization Token string acquired from login api.
 * @apiDescription Retrieve the Selected Carousels channel ID data.
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
 *           id: 1,
 *           carousel_type: 'feed_tv_trending',
 *           company_id: 1,
 *           channel_id: '957,102',
 *           createdAt: 2020-11-24T13:47:25.000Z,
 *           updatedAt: 2020-11-24T13:47:25.000Z
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
exports.getSelectedChannels = async (req, res) => {
    try {
        const idParam = Joi.number().integer().required();
        const {error, value} = idParam.validate(req.params.id);
        if (error) {
            return res.status(400).send({message: 'The carousel channel id is required and must be a number!'});
        }
        let selectedChannels = await models.carousel_channels.findByPk(value, {
            where: {
                company_id: req.token.company_id,
                id: value.id
            }
        })
        if (!selectedChannels) {
            return {"id": ""};
        }

        let addedChannels = selectedChannels.dataValues.channel_id.split(',');
        addedChannels = addedChannels.map(function (elem) {
            if (elem) {
                return {"id": JSON.parse(elem)};
            } else {
                return;
            }
        });

        res.json(addedChannels);
    } catch (err) {
        winston.error("Getting list of selected channels failed with error: ", err);
        res.status(500).json(err);
    }
};
