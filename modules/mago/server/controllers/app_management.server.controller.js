'use strict';

/**
 * Module dependencies.
 */
const path = require('path'),
    errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller')),
    db = require(path.resolve('./config/lib/sequelize')).models,
    winston = require('winston'),
    DBModel = db.app_management,
    fs = require('fs'),
    escape = require(path.resolve('./custom_functions/escape')),
    Joi = require("joi");
const { Op } = require('sequelize')
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
    winston.error("Saving the application data failed with error: ", err);
    return res.status(400).send({
      message: errorHandler.getErrorMessage(err)
    });
  });
};

/**
 * Show current
 */
exports.read = function(req, res) {
  if(req.appManagement.company_id === req.token.company_id) res.json(req.appManagement);
  else return res.status(404).send({message: 'No data with that identifier has been found'});
};

/**
 * Update
 */
exports.update = function(req, res) {

    var updateData = req.appManagement;

    if(updateData.url != req.body.url) {
        var deletefile = path.resolve('./public'+updateData.url);
    }

  if(req.appManagement.company_id === req.token.company_id){
    updateData.update(req.body).then(function(result) {
      if(deletefile) {
        fs.unlink(deletefile, function (err) {
          //todo: return some response?
        });
      }
      res.json(result);
    }).catch(function(err) {
      winston.error("Updating the application data failed with error: ", err);
      req.body.url=url_fields[0];
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
  var deleteData = req.appManagement;

  DBModel.findByPk(deleteData.id).then(function(result) {
    if (result) {
      if (result && (result.company_id === req.token.company_id)) {
        result.destroy().then(function() {
          return res.json(result);
        }).catch(function(err) {
          winston.error("Deleting the application data failed with error: ", err);
          return res.status(400).send({
            message: errorHandler.getErrorMessage(err)
          });
        });
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
    winston.error("Finding the application data failed with error: ", err);
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
    qwhere = {
      [Op.or]: { title: { [Op.like]: `%${query.q}%` } }
    }
  }

  //start building where
  final_where.where = qwhere;
  if(parseInt(query._start)) final_where.offset = parseInt(query._start);
  if(parseInt(query._end)) final_where.limit = parseInt(query._end)-parseInt(query._start);
  if(query._orderBy) final_where.order = [[escape.col(query._orderBy), escape.orderDir(query._orderDir)]];

  final_where.include = [];
  //end build final where

  final_where.where.company_id = req.token.company_id; //return only records for this company

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
    winston.error("Getting the application list failed with error: ", err);
    res.jsonp(err);
  });
};

/**
 * middleware
 */
exports.dataByID = function (req, res, next) {
    const COMPANY_ID = req.token.company_id || 1;
    const getID = Joi.number().integer().required();
    const {error, value} = getID.validate(req.params.appManagementId);

    if (error) {
        return res.status(400).send({
            message: 'Data is invalid'
        });
    }

    DBModel.findOne({
        where: {
            id: value
        }
    }).then(function (result) {
        if (!result) {
            return res.status(404).send({
                message: 'No data with that identifier has been found'
            });
        } else {
            req.appManagement = result;
            let protocol = new RegExp('^(https?|ftp)://');
            if (protocol.test(req.body.url)) {
                let url = req.body.url;
                let pathname = new URL(url).pathname;
                req.body.url = pathname;
            } else {
                req.appManagement.url = req.app.locals.backendsettings[COMPANY_ID].assets_url + result.url;
            }
            next();
        }
    }).catch(function (err) {
        winston.error("Getting the application's data failed with error: ", err);
        return res.status(500).send({
            message: 'Error at getting app management data'
        });
    });

};
