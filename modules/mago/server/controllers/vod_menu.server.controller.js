'use strict';

/**
 * Module dependencies.
 */
const path = require('path'),
    errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller')),
    logHandler = require(path.resolve('./modules/mago/server/controllers/logs.server.controller')),
    winston = require('winston'),
    db = require(path.resolve('./config/lib/sequelize')),
    sequelize = require('sequelize'),
    models = db.models,
    DBModel = models.vod_menu,
    Joi = require("joi");

/**
 * Create
 */
exports.create = function(req, res) {

    logHandler.add_log(req.token.id, req.ip.replace('::ffff:', ''), 'created', JSON.stringify(req.body));
    req.body.company_id = req.token.company_id; //save record for this company
    DBModel.create(req.body).then(function(result) {
        if (!result) {
            return res.status(400).send({message: 'fail create data'});
        } else {
            return res.jsonp(result);
        }
    }).catch(function(err) {
        winston.error("Error creating vod menu carousel, error: ",err);
        return res.status(400).send({
            message: errorHandler.getErrorMessage(err)
        });
    });
};

/**
 * Show current
 */
exports.read = function(req, res) {
    if(req.vodmenu.company_id === req.token.company_id) res.json(req.vodmenu);
    else return res.status(404).send({message: 'No data with that identifier has been found'});
};

/**
 * Update
 */
exports.update = function(req, res) {
    var updateData = req.vodmenu;

    if(req.vodmenu.company_id === req.token.company_id){
        updateData.update(req.body).then(function(result) {
            logHandler.add_log(req.token.id, req.ip.replace('::ffff:', ''), 'created', JSON.stringify(req.body), req.token.company_id);
            res.json(result);
            return null;
        }).catch(function(err) {
            winston.error("Error updating vod menu, error: ", err);
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
    var deleteData = req.vodmenu;

    DBModel.findByPk(deleteData.id).then(function(result) {
        if (result) {
            if (result && (result.company_id === req.token.company_id)) {
                result.destroy().then(function() {
                    return res.json(result);
                }).catch(function(err) {
                    winston.error("Error at deleting vod menu server, error: ",err);
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

    var qwhere = {},
        final_where = {},
        query = req.query;

    //start building where
    final_where.where = qwhere;
    if(parseInt(query._start)) final_where.offset = parseInt(query._start);
    if(parseInt(query._end)) final_where.limit = parseInt(query._end)-parseInt(query._start);
    if(query._orderBy) final_where.order = [[query._orderBy, query._orderDir]];
    
    //end build final where

    final_where.where.company_id = req.token.company_id; //return only records for this company

    final_where.attributes = [ 'id', 'company_id','name','description','order', 'pin_protected', 'isavailable', 'is_adult',
        'createdAt', 'updatedAt',[db.sequelize.fn("concat", req.app.locals.backendsettings[req.token.company_id].assets_url, db.sequelize.col('icon_url')), 'icon_url']],

        DBModel.findAndCountAll(

        final_where

    ).then(function(results) {
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
exports.dataByID = function(req, res, next) {

    const COMPANY_ID = req.token.company_id || 1;
    const getID = Joi.number().integer().required();
    const {error, value} = getID.validate(req.params.vodmenuId);

    if (error) {
        return res.status(400).send({
            message: 'Data is invalid'
        });
    }

    DBModel.findOne({
        where: {
            id: value
        }
    }).then(function(result) {
        if (!result) {
            return res.status(404).send({
                message: 'No data with that identifier has been found'
            });
        } else {
            req.vodmenu = result;
            let protocol = new RegExp('^(https?|ftp)://');
            if (protocol.test(req.body.icon_url)) {
                let url = req.body.icon_url;
                let pathname = new URL(url).pathname;
                req.body.icon_url = pathname;
            } else {
                req.vodmenu.icon_url = req.app.locals.backendsettings[COMPANY_ID].assets_url + result.icon_url;
            }
            next();
            return null;
        }
    }).catch(function(err) {
        winston.error(err);
        return res.status(500).send({
            message: 'Error at getting vod menu data'
        });
    });

};