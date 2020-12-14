'use strict';

/**
 * Module dependencies.
 */
const path = require('path'),
    errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller')),
    winston = require('winston'),
    db = require(path.resolve('./config/lib/sequelize')).models,
    DBModel = db.vod_subtitles,
    fs = require('fs'),
    Joi = require("joi");
const { Op } = require('sequelize');
/**
 * Create
 */
exports.create = function(req, res) {

    req.body.company_id = req.token.company_id; //save record for this company
    DBModel.create(req.body).then(function(result) {
        if (!result) {
            return res.status(400).send({message: 'fail create data'});
        } else {

            return res.jsonp(result);
        }
    }).catch(function(err) {
        winston.error(err);
        return res.status(400).send({
            message: errorHandler.getErrorMessage(err)
        });
    });
};

/**
 * Show current
 */
exports.read = function(req, res) {
    if(req.vodSubtitle.company_id === req.token.company_id) res.json(req.vodSubtitle);
    else return res.status(404).send({message: 'No data with that identifier has been found'});
};

/**
 * Update
 */
exports.update = function(req, res) {
    var updateData = req.vodSubtitle;

    var updateData = req.vodSubtitle;
    if(updateData.subtitle_url != req.body.subtitle_url) {
        var deletefile = path.resolve('./public'+updateData.subtitle_url);
    }

    if(req.vodSubtitle.company_id === req.token.company_id){
        updateData.update(req.body).then(function(result) {
            if(deletefile) {
                fs.unlink(deletefile, function (err) {
                    //todo: return ome warning
                });
            }
            res.json(result);
        }).catch(function(err) {
            winston.error(err);
            return res.status(400).send({
                message: errorHandler.getErrorMessage(err)
            });
        });
    }
    else{
        res.status(404).send({message: 'User not authorized to access these data'});
    }

};

/**
 * Delete
 */
exports.delete = function(req, res) {
    var deleteData = req.vodSubtitle;

    DBModel.findByPk(deleteData.id).then(function(result) {
        if (result) {
            if (result && (result.company_id === req.token.company_id)) {
                result.destroy().then(function() {
                    return res.json(result);
                }).catch(function(err) {
                    winston.error(err);
                    return res.status(400).send({
                        message: errorHandler.getErrorMessage(err)
                    });
                });
                return null;
            }
            else{
                return res.status(400).send({message: 'Unable to find the Data'});
            }
        } else {
            return res.status(400).send({
                message: 'Unable to find the Data'
            });
        }
        return null;
    }).catch(function(err) {
        winston.error(err);
        return res.status(400).send({
            message: errorHandler.getErrorMessage(err)
        });
    });

};

/**
 * List
 */
exports.list = function(req, res) {

    var query = req.query;
    var offset_start = parseInt(query._start);
    var records_limit = query._end - query._start;
    var qwhere = {};
    if(query.vod_id) qwhere.vod_id = query.vod_id;

    if (query.q) {
        qwhere = Object.assign(qwhere, {
            [Op.or]: [
                { vod_id: { [Op.like]: `%${query.q}%` } },
                { title: { [Op.like]: `%${query.q}%` } }
            ]
        })
    }
    qwhere.company_id = req.token.company_id; //return only records for this company

  DBModel.findAndCountAll({
    where: qwhere,
    offset: offset_start,
    limit: records_limit,
    include: [db.vod]
  }).then(function(results) {
    if (!results) {
      return res.status(404).send({
        message: 'No data found'
      });
    } else {

      res.setHeader("X-Total-Count", results.count);
      res.json(results.rows);
    }
  }).catch(function(err) {
      winston.error(err);
    res.jsonp(err);
  });
};

/**
 * middleware
 */
exports.dataByID = function (req, res, next) {
    const COMPANY_ID = req.token.company_id || 1;
    const getID = Joi.number().integer().required();
    const {error, value} = getID.validate(req.params.vodSubtitleId);

    if (error) {
        return res.status(400).send({
            message: 'Data is invalid'
        });
    }

    DBModel.findOne({
        where: {
            id: value
        },
        include: [{model: db.vod}]
    }).then(function (result) {
        if (!result) {
            return res.status(404).send({
                message: 'No data with that identifier has been found'
            });
        } else {
            req.vodSubtitle = result;
            let protocol = new RegExp('^(https?|ftp)://');
            if (protocol.test(req.body.subtitle_url)) {
                let url = req.body.subtitle_url;
                let pathname = new URL(url).pathname;
                req.body.subtitle_url = pathname;
            } else {

                req.vodSubtitle.subtitle_url = req.app.locals.backendsettings[COMPANY_ID].assets_url + result.subtitle_url;
            }
            next();
            return null
        }
    }).catch(function (err) {
        winston.error(err);
        return res.status(500).send({
            message: 'Error at getting vod subtitles data'
        })
    });

};
