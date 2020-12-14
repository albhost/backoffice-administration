'use strict';

/**
 * Module dependencies.
 */
const path = require('path'),
    errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller')),
    db = require(path.resolve('./config/lib/sequelize')),
    sequelize = require('sequelize'),
    models = db.models,
    DBModel = db.models.genre,
    winston = require('winston'),
    fs = require('fs'),
    Joi = require("joi");
const { Op } = require('sequelize');
const escape = require(path.resolve('./custom_functions/escape'));


/**
 * Create
 */
exports.create = function(req, res) {

    DBModel.findOne({
        attributes: ['id'],
        order: [['id', 'DESC']]
    }).then(function(result) {
        //category id nr 666 is reserved for Favorites, so it will not be assigned to any category
        if(result && result.id === 665){
            req.body.id = 667;
        }
        req.body.company_id = req.token.company_id; //save record for this company
        DBModel.create(req.body).then(function(result) {
            if (!result) {
                return res.status(400).send({message: 'fail create data'});
            } else {
                return res.jsonp(result);
            }
        }).catch(function(err) {
            winston.error("Creating genre failed with error: ", err);
            return res.status(400).send({
                message: errorHandler.getErrorMessage(err)
            });
        });
        return null;
    }).catch(function(err) {
        winston.error("Getting genre data failed with error: ", err);
        return res.status(400).send({
            message: errorHandler.getErrorMessage(err)
        });
    });

};

/**
 * Show current
 */
exports.read = function(req, res) {
    if(req.genre.company_id === req.token.company_id) res.json(req.genre);
    else return res.status(404).send({message: 'No data with that identifier has been found'});
};

/**
 * Update
 */
exports.update = function(req, res) {
    var updateData = req.genre;

    if(req.genre.company_id === req.token.company_id){
        if(updateData.icon_url != req.body.icon_url) {
            var deletefile = path.resolve('./public'+updateData.icon_url);
        }
        updateData.update(req.body).then(function(result) {
            if(deletefile)
                fs.unlink(deletefile, function (err) {
                    //todo: return some error message???
                });
            return res.jsonp(result);
        }).catch(function(err) {
            winston.error("Updating genre failed with error: ", err);
            res.status(400).send({
                message: errorHandler.getErrorMessage(err)
            });
            return null;
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
    var deleteData = req.genre;

    DBModel.findByPk(deleteData.id).then(function(result) {
        if (result) {
            if (result && (result.company_id === req.token.company_id)) {
                result.destroy().then(function() {
                    return res.json(result);
                }).catch(function(ER_ROW_IS_REFERENCED_2) {
                    return res.status(400).send({ message: "Cannot delete genre with channels" }) //this row is referenced by another record
                }).catch(function(error) {
                    winston.error("Deleting genre failed with error: ", error);
                    return res.status(400).send({ message: "Unable to delete genre" })
                });
            }
            else{
                return res.status(400).send({message: 'Unable to find the Data'});
            }
        } else {
            return res.status(400).send({ message: 'Unable to find the Data' });
        }
        return null;
    }).catch(function(err) {
        winston.error("Finding genre failed with error: ", err);
        return res.status(400).send({ message: "Unable to delete genre" });
    });

};

/**
 * List
 */
exports.list = function(req, res) {

  var qwhere = {},
      final_where = {},
      query = req.query;

  if(query.q) {
    qwhere = {
        [Op.or]: { description: { [Op.like]: `%${query.q}%` } }
    }
  }

  //start building where
  final_where.where = qwhere;
  if(parseInt(query._start)) final_where.offset = parseInt(query._start);
  if(parseInt(query._end)) final_where.limit = parseInt(query._end)-parseInt(query._start);
  if(query._orderBy) final_where.order = [[escape.col(query._orderBy), escape.orderDir(query._orderDir)]];


  final_where.include = [{model:db.models.channels,  required: true}];

    DBModel.findAndCountAll({
        attributes: ['id', 'description', [db.sequelize.fn("concat", req.app.locals.backendsettings[req.token.company_id].assets_url, db.sequelize.col('genre.icon_url')), 'icon_url'], 'is_available', 'order', 'pin_protected', 'is_adult'],
        where: {company_id: req.token.company_id},
        include: [{
            model: db.models.channels, required: false,
            attributes: [[db.sequelize.fn('count', db.sequelize.col('channels.id')), 'total']],
            nested: true
        }],
        order: [['order', 'ASC']],
        group: ['genre.id', 'genre.description']
    }).then(function (results) {
        if (!results) {
            res.status(404).send({
                message: 'No data found'
            });
            return null;
        } else {
            res.setHeader("X-Total-Count", results.count);
            return res.json(results.rows);
        }
    }).catch(function (err) {
        winston.error("Getting genre list failed with error: ", err);
        return res.jsonp(err);
    });
};

/**
 * middleware
 */
exports.dataByID = function(req, res, next) {
    const COMPANY_ID = req.token.company_id || 1;
    const getID = Joi.number().integer().required();
    const {error, value} = getID.validate(req.params.genreId);

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
      res.status(404).send({
        message: 'No data with that identifier has been found'
      });
    } else {
      req.genre = result;
        let protocol = new RegExp('^(https?|ftp)://');
        if (protocol.test(req.body.icon_url)) {
            let url = req.body.icon_url;
            let pathname = new URL(url).pathname;
            req.body.icon_url = pathname;
        } else {
            req.genre.icon_url = req.app.locals.backendsettings[COMPANY_ID].assets_url + result.icon_url;
        }
      next();
      return null;
    }
  }).catch(function(err) {
      winston.error("Finding genre failed with error: ", err);
      return res.status(500).send({
          message: 'Error at getting genre data'
      });
  });

};
