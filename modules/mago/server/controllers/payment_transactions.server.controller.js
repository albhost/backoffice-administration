'use strict';

/**
 * Module dependencies.
 */
const path = require('path'),
    winston = require('winston'),
    db = require(path.resolve('./config/lib/sequelize')).models,
    DBModel = db.payment_transactions,
    Joi = require("joi");
const { Op } = require('sequelize');

/**
 * Show current
 */
exports.read = function(req, res) {
    if(req.paymentTransaction.company_id === req.token.company_id) res.json(req.paymentTransaction);
    else return res.status(404).send({message: 'No data with that identifier has been found'});
};

/**
 * List
 */
exports.list = function(req, res) {

    var qwhere = {},
        final_where = {},
        query = req.query;

    if(query.q) {
        qwhere = { [Op.or]: { title: { [Op.like]: `%${query.q}%` } } }
    }

    //start building where
    final_where.where = qwhere;
    if(parseInt(query._start)) final_where.offset = parseInt(query._start);
    if(parseInt(query._end)) final_where.limit = parseInt(query._end)-parseInt(query._start);
    if(query._orderBy) final_where.order = [[query._orderBy, query._orderDir]];
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
        winston.error("Getting transaction list failed with error: ", err);
        res.jsonp(err);
    });
};

/**
 * middleware
 */
exports.dataByID = function(req, res, next) {

    const getID = Joi.number().integer().required();
    const {error, value} = getID.validate(req.params.PaymentTransactionID);

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
            req.paymentTransaction = result;
            req.paymentTransaction.full_log = JSON.parse(result.full_log);
            next();
            return null;
        }
    }).catch(function(err) {
        winston.error("Getting transaction data failed with error: ", err);
        return res.status(500).send({
            message: 'Error at getting  my payment transactions data'
        });
    });

};
