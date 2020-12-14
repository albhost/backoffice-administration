'use strict';

/**
 * Module dependencies.
 */
const path = require('path'),
    errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller')),
    logHandler = require(path.resolve('./modules/mago/server/controllers/logs.server.controller')),
    winston = require('winston'),
    db = require(path.resolve('./config/lib/sequelize')).models,
    url = require('url'),
    DBModel = db.vod_menu_carousel,
    Joi = require("joi");;


/**
 * Create
 */
exports.create = function(req, res) {
    let carousel_url = '';
    if(req.body.category_id === null || req.body.category_id === '') {
        carousel_url = req.body.url + '?' + 'pin_protected=' + req.body.pin_protected + '&' + 'adult_content=' + req.body.adult_content+ '&' + 'order_by=' +req.body.order_by+ '&' +'order_dir=' + req.body.order_dir;
    }
    else {
        carousel_url = req.body.url+ '?' +'category_id=' + req.body.category_id + '&'+ 'pin_protected='+req.body.pin_protected+ '&'+ 'adult_content=' +req.body.adult_content+ '&' + 'order_by=' +req.body.order_by+ '&' +'order_dir=' +req.body.order_dir;

    }
    req.body.url = carousel_url;
    req.body.company_id = req.token.company_id; //save record for this company
    DBModel.create(req.body, {logging: console.log}).then(function(result) {

        if (!result) {
            winston.error("Failed creating vod_menu");
            return res.status(400).send({message: 'fail create data'});
        } else {
            logHandler.add_log(req.token.id, req.ip.replace('::ffff:', ''), 'created', JSON.stringify(req.body), req.token.company_id);
            return res.jsonp(result);
            return null;
        }
    }).catch(function(err) {
        winston.error("Failed creating vod_menu, error: ", err);
        return res.status(400).send({
            message: errorHandler.getErrorMessage(err)
        });
    });
};

/**
 * Show current
 */
exports.read = function(req, res) {
    var readData = req.vodmenucarousel;
    if(readData.company_id === req.token.company_id)
        res.json(readData)
    else return res.status(404).send({message: 'No data with that identifier has been found'});
};

/**
 * Update
 */
exports.update = function(req, res) {
    var updateData = req.vodmenucarousel;

   let carousel_url = '';

    if (!req.body.category_id){
        carousel_url = req.body.url + '?' + 'pin_protected=' + req.body.pin_protected + '&' + 'adult_content=' + req.body.adult_content+ '&' + 'order_by=' +req.body.order_by+ '&' +'order_dir=' + req.body.order_dir;
    }
    else if(req.body.category_id === null || req.body.category_id === '' || req.body.category_id === 'undefined') {
        carousel_url = req.body.url + '?' + 'pin_protected=' + req.body.pin_protected + '&' + 'adult_content=' + req.body.adult_content+ '&' + 'order_by=' +req.body.order_by+ '&' +'order_dir=' + req.body.order_dir;
    }
    else {
        carousel_url = req.body.url+ '?' +'category_id=' + req.body.category_id + '&'+ 'pin_protected='+req.body.pin_protected+ '&'+ 'adult_content=' +req.body.adult_content+ '&' + 'order_by=' +req.body.order_by+ '&' +'order_dir=' +req.body.order_dir;

    }
    req.body.url = carousel_url;


    let carousel_params = url.parse(updateData.dataValues.url, true)
    var qdata = carousel_params.query;
    updateData.dataValues = Object.assign(updateData.dataValues,qdata);

    if(updateData.company_id === req.token.company_id){
        updateData.update(req.body).then(function(result) {
            logHandler.add_log(req.token.id, req.ip.replace('::ffff:', ''), 'created', JSON.stringify(req.body), req.token.company_id);
            res.json(result);
            return null;
        }).catch(function(err) {
            winston.error("Error at updating vod menu carousel attributes, error: ",err);
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
    var deleteData = req.vodmenucarousel;

    DBModel.findByPk(deleteData.id).then(function(result) {
        if (result) {
            if (result && (result.company_id === req.token.company_id)) {
                result.destroy().then(function() {
                    return res.json(result);
                }).catch(function(err) {
                    winston.error("Failed deleting vod menu carousel, error: ", err);
                    return res.status(400).send({
                        message: errorHandler.getErrorMessage(err)
                    });
                });
            }
            else {
                return res.status(400).send({message: 'Unable to find the Data'});
            }
        } else {
            return res.status(400).send({
                message: 'Unable to find the Data'
            });
        }
        return false;
    }).catch(function(err) {
        winston.error("Error at vod menu carousel, error: ", err);
        return res.status(400).send({
            message: errorHandler.getErrorMessage(err)
        });
    });
};

/**
 * List
 */
exports.list = function (req, res) {

    let qwhere = {},
        final_where = {},
        query = req.query;

    //start building where
    final_where.where = qwhere;
    if (parseInt(query._start)) final_where.offset = parseInt(query._start);
    if (parseInt(query._end)) final_where.limit = parseInt(query._end) - parseInt(query._start);
    if (query._orderBy) final_where.order = [[query._orderBy, query._orderDir]]
    else final_where.order = [['order', 'ASC']];

    final_where.include = [];
    //end build final where

    if (query.vod_menu_id) qwhere.vod_menu_id = query.vod_menu_id;
    final_where.where.company_id = req.token.company_id; //return only records for this company

    DBModel.findAndCountAll(
      final_where
    ).then(function (results) {
        if (!results) {
            return res.status(404).send({
                message: 'No data found'
            });
        } else {

            res.setHeader("X-Total-Count", results.count);
            res.json(results.rows);
        }
    }).catch(function (err) {
        winston.error("Error listing vod menu carousel, error: ", err);
        res.jsonp(err);
    });
};

/**
 * middleware
 */
exports.dataByID = function(req, res, next) {

    const getID = Joi.number().integer().required();
    const {error, value} = getID.validate(req.params.vodmenucarouselId);

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
            let carousel_params = url.parse(result.dataValues.url, true)
            var qdata = carousel_params.query;
            result.dataValues = Object.assign(result.dataValues,qdata);
            result.dataValues.url=carousel_params.pathname;
            req.vodmenucarousel = result;
            result.dataValues.pin_protected = result.dataValues.pin_protected == 'true';
            result.dataValues.adult_content = result.dataValues.adult_content == 'true';
            next();
            return null;
        }
    }).catch(function(err) {
        winston.error("Error fetching dataById at vod menu carousel, error: ", err);
        return res.status(500).send({
            message: 'Error at getting vod menu carousel data'
        });
    });

};