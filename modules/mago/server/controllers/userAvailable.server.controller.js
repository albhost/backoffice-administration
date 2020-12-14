'use strict';

/**
 * Module dependencies.
 */
var path = require('path'),
  winston = require('winston'),
  db = require(path.resolve('./config/lib/sequelize')).models,
  DBModel = db.users;
const { Op } = require('sequelize');

/**
 * List
 */
exports.list = function(req, res) {

  var qwhere = {},
      final_where = {},
      query = req.query;

  if(query.q) {
    let filters = []
    filters.push(
      { username: { [Op.like]: `%${query.q}%` } },
      { email: { [Op.like]: `%${query.q}%` } },
      { telephone: { [Op.like]: `%${query.q}%` } },
    );
    qwhere = { [Op.or]: filters };
  }

  //start building where
  final_where.where = qwhere;
  if(parseInt(query._start)) final_where.offset = parseInt(query._start);
  if(parseInt(query._end)) final_where.limit = parseInt(query._end)-parseInt(query._start);
  if(query._orderBy) final_where.order = [[query._orderBy, query._orderDir]];

    if(query.group_id) qwhere.group_id = query.group_id;
    if(query.company_id) qwhere.company_id = query.company_id;

    final_where.where.company_id = req.token.company_id;
    final_where.where.isavailable = 1;
    final_where.include = [
      {
        model: db.groups,
        required: true,
        attributes: ['code'],
      }
    ] 
      

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
    winston.error("Getting user list failed with error: ", err);
    res.jsonp(err);
  });
};



