'user strict';

var path = require('path'),
    errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller')),
    db = require(path.resolve('./config/lib/sequelize')).models,
    moment = require('moment'),
    DBModel = db.epg_data,
    winston = require(path.resolve('./config/lib/winston'));




/**
 * @api {post} /api/public/epg/insert Insert Epg Record
 * @apiVersion 0.2.0
 * @apiName InsertEpgRecord
 * @apiGroup EPG
 * @apiParam (Query parameters) {String} apikey Authorization key as query parameter
 * @apiSuccess (200) {Object[]} data Inserted Record

 * @apiParam (Query parameters) {String} apikey Authorization key as query parameter

 * @apiParam {number} channel_number Channel number to insert EPG
 * @apiParam {datetime} program_start Datetime when program starts
 * @apiParam {datetime} program_end Datetime when program ends
 * @apiParam {String} title Program title
 * @apiParam {String} short_name Program short description
 * @apiParam {String} long_description Program long description
 * @apiParam {Number} duration_seconds If missing, system will calculate
 * @apiParam {boolean} livestream Shows if program is live
 * @apiParam {String} genre Genre of channels
 * @apiParam {String} audio Audio
 * @apiParam {String} rating_score Rating score of program
 * @apiParam {boolean} parental_control Channel parental control
 * @apiParam {String} content_rating Content rating for minimum age
 * @apiParam {String} banner_url Program image
 *
 * @apiError (40x) {Object} error Error-Response
 * @apiError {Number} error.code Code
 * @apiError {String} error.message Message description of error
 */

exports.insert_epg_row = function(req, res) {
    db.channels.findOne({
        attributes: ['id'], where: {channel_number: req.body.channel_number, company_id: req.token.company_id}
    }).then(function(result) {
        if(result) {
            req.body.channels_id = result.id;
            req.body.company_id = req.token.company_id;

            if(!req.body.duration_seconds) {
                req.body.duration_seconds = moment(req.body.program_end).diff(moment(req.body.program_start), 'seconds');
            }
            else {
                req.body.duration_seconds *= 1;
            }

            DBModel.create(req.body).then(function(result) {
                if (!result) {
                    return res.status(400).send({message: 'fail create data'});
                } else {
                    return res.jsonp(result);
                }
            }).catch(function(err) {
                winston.error("Creating event failed with error: ", err);
                return res.status(400).send({
                    message: errorHandler.getErrorMessage(err)
                });
            });
        }
        else {
            return res.send({
                message: "Channel not found"
            });
        }
        return null;
    }).catch(function(err) {
        winston.error("Finding channel failed with error: ", err);
        res.status(500).send({
            error: { code: 500, message: 'Internal error'}
        });
    });
};
