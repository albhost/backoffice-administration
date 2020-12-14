'use strict';

/**
 * Module dependencies.
 */
var path = require('path'),
    errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller')),
    winston = require('winston'),
    db = require(path.resolve('./config/lib/sequelize')),
    sequelize = require('sequelize'),
    models = require(path.resolve('./config/lib/sequelize')).models;

/**
 * Create
 */
exports.create = function(req, res) {
    req.body.company_id = req.token.company_id; //save record for this company
    models.banners.create(req.body).then(function(result) {
        if (!result) {
            res.status(400).send({message: 'Failed to create banner'});
            return;
        }

        res.json(result);
    }).catch(function(err) {
        winston.error('Creating banner failed with error: ', err);
        res.status(400).send({
            message: errorHandler.getErrorMessage(err)
        });
    });
};

/**
 * Show current
 */
exports.read = function(req, res) {
    res.json(req.banner);
};

/**
 * Update
 */
exports.update = function(req, res) {
    req.banner.update(req.body).then(function(result) {
        res.json(result);
    }).catch(function(err) {
        winston.error("Updating banner failed with error: ", err);
        return res.status(400).send({
            message: errorHandler.getErrorMessage(err)
        });
    });
};

/**
 * Delete
 */
exports.delete = function(req, res) {
    req.banner.destroy().then(function() {
        res.json(req.banner);
    }).catch(function(err) {
        winston.error('Deleting banner failed with error: ', err);
        res.status(400).send({
            message: errorHandler.getErrorMessage(err)
        });
    });
};

/**
 * List
 */
exports.list = function(req, res) {

    var qwhere = {company_id: req.token.company_id},
        final_where = {},
        query = req.query;

    //start building where
    final_where.where = qwhere;
    if(parseInt(query._end) !== -1){
        if(parseInt(query._start)) final_where.offset = parseInt(query._start);
        if(parseInt(query._end)) final_where.limit = parseInt(query._end)-parseInt(query._start);
    }

    final_where.attributes = [ 'id', 'company_id','name','size', 'link',[db.sequelize.fn("concat", req.app.locals.backendsettings[req.token.company_id].assets_url, db.sequelize.col('img_url')), 'img_url']],

        models.banners.findAndCountAll(final_where)
        .then(function(results) {
            if (!results) {
                return res.status(404).send({
                    message: 'No data found'
                });
            } else {
                res.setHeader("X-Total-Count", results.count);
                res.json(results.rows);
            }
        }).catch(function(err) {
            winston.error("Getting list of banners failed with error: ", err);
            res.json(err);
        });
};

/**
 * middleware
 */
exports.dataByID = function(req, res, next) {
    let id = req.params.id;

    models.banners.findOne({
        where: {id: id, company_id: req.token.company_id},
    }).then(function(result) {
        if (!result) {
            res.status(404).send({
                message: 'No data with that identifier has been found'
            });
        } else {
            req.banner = result;
            next();
            return null;
        }
    }).catch(function(err) {
        winston.error("Getting banners failed with error: ",err);
        res.status(400).send({
            message: errorHandler.getErrorMessage(err)
        });
    });
};
