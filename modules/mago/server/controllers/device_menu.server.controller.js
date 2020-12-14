'use strict';

/**
 * Module dependencies.
 */
const path = require('path'),
    errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller')),
    db = require(path.resolve('./config/lib/sequelize')),
    winston = require('winston'),
    models = db.models,
    DBModel = models.device_menu,
    fs = require('fs'),
    escape = require(path.resolve('./custom_functions/escape')),
    Joi = require("joi");
const { Op } = require('sequelize');
/**
 * Create
 */
exports.create = function(req, res) {

    req.body.appid = req.body.appid.toString();
    req.body.company_id = req.token.company_id; //save record for this company

    DBModel.create(req.body).then(function(result) {
        if (!result) {
            return res.status(400).send({message: 'fail create data'});
        } else {
            return res.jsonp(result);
        }
    }).catch(function(err) {
        if(err.name === "SequelizeUniqueConstraintError"){
            if(err.errors[0].path === "position")  return res.status(400).send({message: 'This position is being used by another menu'}); //position is taken
            else return res.status(400).send({message: err.errors[0].message}); //other duplicate fields. return sequelize error message
        }
        else {
            winston.error("Creating menu failed with error: ", err);
            return res.status(400).send({message: 'An error occurred while creating menu item. '+err.errors[0].message}); //another error occurred. return sequelize error message
        }
    });
};


/**
 * Show current
 */

exports.read = function(req, res) {
    if(req.deviceMenu.company_id === req.token.company_id) res.json(req.deviceMenu);
    else return res.status(404).send({message: 'No data with that identifier has been found'});
};



/**
 * Update
 */
exports.update = function(req, res) {

    var updateData = req.deviceMenu;
    if(updateData.icon_url != req.body.icon_url) {
        var deletefile = path.resolve('./public'+updateData.icon_url);
        updateData.icon_url = req.body.icon_url;
    }
    req.body.appid = req.body.appid.toString();

    if(req.body.company_id === req.token.company_id){
        updateData.update(req.body).then(function(result){
            if(deletefile) {
                fs.unlink(deletefile, function (err) {
                    //todo: do sth on error?
                });
            }
            res.json(result);
        }).catch(function(err) {
            if(err.name === "SequelizeUniqueConstraintError"){
                if(err.errors[0].path === "position")  return res.status(400).send({message: 'This position is being used by another menu'}); //position is taken
                else return res.status(400).send({message: err.errors[0].message}); //other duplicate fields. return sequelize error message
            }
            else {
                winston.error("Updating menu failed with error: ", err);
                return res.status(400).send({message: 'An error occurred while editing menu item. '+err.errors[0].message}); //another error occurred. return sequelize error message
            }
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
    var deleteData = req.deviceMenu;

    DBModel.findByPk(deleteData.id).then(function(result) {
        if (result) {
            if (result && (result.company_id === req.token.company_id)) {
                result.destroy().then(function() {
                    return res.json(result);
                }).catch(function(err) {
                    winston.error("Deleting menu failed with error: ", err);
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
        winston.error("Finding failed with error: ", err);
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
        qwhere = { [Op.or]: { title: { [Op.like]: `%${query.q}%` } } }
    }

  //start building where
  final_where.where = qwhere;
  if(parseInt(query._start)) final_where.offset = parseInt(query._start);
  if(parseInt(query._end)) final_where.limit = parseInt(query._end)-parseInt(query._start);
  if(query._orderBy) final_where.order = [[escape.col(query._orderBy), escape.orderDir(query._orderDir)]];
  final_where.include = [];
  //end build final where
    final_where.attributes = [ 'id', 'company_id','title','url','appid', 'menu_code', 'position', 'menu_level', 'parent_id','menu_description', 'locale',
        'is_guest_menu','isavailable', 'createdAt', 'updatedAt',[db.sequelize.fn("concat", req.app.locals.backendsettings[req.token.company_id].assets_url, db.sequelize.col('icon_url')), 'icon_url']],

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
      winston.error("Getting menu list failed with error: ", err);
    res.jsonp(err);
  });
};

/**
 * middleware
 */
exports.dataByID = function(req, res, next) {
    const COMPANY_ID = req.token.company_id || 1;
    const getID = Joi.number().integer().required();
    const {error, value} = getID.validate(req.params.deviceMenuId);

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
      req.deviceMenu = result;
      req.deviceMenu.appid = JSON.parse("[" + req.deviceMenu.appid + "]");
        let protocol = new RegExp('^(https?|ftp)://');
        if (protocol.test(req.body.icon_url)) {
            let url = req.body.icon_url;
            let pathname = new URL(url).pathname;
            req.body.icon_url = pathname;
        } else {
            req.deviceMenu.icon_url = req.app.locals.backendsettings[COMPANY_ID].assets_url + result.icon_url;
        }
      next();
      return null;
    }
  }).catch(function(err) {
      winston.error("Getting menu data failed with error: ", err);
      return res.status(500).send({
          message: 'Error at getting menu data'
      });
  });

};
