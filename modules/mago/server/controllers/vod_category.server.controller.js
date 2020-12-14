'use strict';

/**
 * Module dependencies.
 */
const path = require('path'),
    errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller')),
    winston = require('winston'),
    db = require(path.resolve('./config/lib/sequelize')),
    models = db.models,
    DBModel = models.vod_category,
    fs = require('fs'),
    escape = require(path.resolve('./custom_functions/escape')),
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
        winston.error("Error creating vod category, error: ", err);
        return res.status(400).send({
            message: errorHandler.getErrorMessage(err)
        });
    });
};

/**
 * Show current
 */
exports.read = function(req, res) {
    if(req.vodCategory.company_id === req.token.company_id) res.json(req.vodCategory);
    else return res.status(404).send({message: 'No data with that identifier has been found'});
};

/**
 * Update
 */
exports.update = function(req, res) {
    var updateData = req.vodCategory;
    if(updateData.icon_url != req.body.icon_url) {
        var deletefile = path.resolve('./public'+updateData.icon_url);
    }
    if(updateData.small_icon_url != req.body.small_icon_url) {
        var deletesmallfile = path.resolve('./public'+updateData.small_icon_url);
    }

    if(req.vodCategory.company_id === req.token.company_id){
        updateData.update(req.body).then(function(result) {
            if(deletefile) {
                fs.unlink(deletefile, function (err) {
                    //todo: display some warning
                });
            }
            if(deletesmallfile) {
                fs.unlink(deletesmallfile, function (err) {
                    //todo: display some warning
                });
            }
            res.json(result);
        }).catch(function(err) {
            winston.error("Error updating vod category, error: ",err);
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
    var deleteData = req.vodCategory;
    DBModel.findByPk(deleteData.id).then(function(result) {
        if (result) {
            if (result && (result.company_id === req.token.company_id)) {
                result.destroy().then(function() {
                    return res.json(result);
                }).catch(function(err) {
                    winston.error("Error deleting vod category, error: ", err);
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

    if (query.q) {
        let filters = []
        filters.push(
            { name: { [Op.like]: `%${query.q}%` } },
            { description: { [Op.like]: `%${query.q}%` } }
        );
        qwhere = { [Op.or]: filters };
    }

    if(query.category_id && Array.isArray(query.category_id)) {
      let valid = true;
      const arr = query.category_id.map(cId => {
        const n = parseInt(cId);
        if(Number.isNaN(n)) {
          valid = false;
        }
        return n;
      });
      if(valid) {
        qwhere.id = {[Op.in]: arr}
      }
    }

  //start building where
  final_where.where = qwhere;
  if(parseInt(query._end) !== -1){
      if(parseInt(query._start)) final_where.offset = parseInt(query._start);
      if(parseInt(query._end)) final_where.limit = parseInt(query._end)-parseInt(query._start);
  }
  if(query._orderBy) final_where.order = [[escape.col(query._orderBy), escape.orderDir(query._orderDir)]];
  final_where.include = [];

    final_where.where.company_id = req.token.company_id; //return only records for this company
    final_where.attributes = [ 'id', 'company_id','name','description', 'pay', 'password', 'sorting',
        'isavailable', 'createdAt', 'updatedAt',[db.sequelize.fn("concat", req.app.locals.backendsettings[req.token.company_id].assets_url, db.sequelize.col('vod_category.icon_url')), 'icon_url'],
        [db.sequelize.fn("concat", req.app.locals.backendsettings[req.token.company_id].assets_url, db.sequelize.col('vod_category.small_icon_url')), 'small_icon_url']],


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
    const {error, value} = getID.validate(req.params.vodCategoryId);

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
      req.vodCategory = result;
        let protocol = new RegExp('^(https?|ftp)://');
        if (protocol.test(req.body.icon_url)) {
            let url = req.body.icon_url;
            let pathname = new URL(url).pathname;
            req.body.icon_url = pathname;
        } else {
            req.vodCategory.icon_url = req.app.locals.backendsettings[COMPANY_ID].assets_url + result.icon_url;
        }

        let protocol_small_icon = new RegExp('^(https?|ftp)://');
        if (protocol_small_icon.test(req.body.small_icon_url)) {
            let url = req.body.small_icon_url;
            let pathname = new URL(url).pathname;
            req.body.small_icon_url = pathname;
        } else {
            req.vodCategory.small_icon_url = req.app.locals.backendsettings[COMPANY_ID].assets_url + result.small_icon_url;
        }
      next();
      return null;
    }
  }).catch(function(err) {
      winston.error(err);
      return res.status(500).send({
          message: 'Error at getting vod category data'
      });
  });

};
