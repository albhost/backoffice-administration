'use strict';
//part of customization for mettre

/**
 * Module dependencies.
 */
const path = require('path'),
    saas_functions = require(path.resolve('./custom_functions/saas_functions')),
    customerFunctions = require(path.resolve('./custom_functions/customer_functions.js')),
    eventSystem = require(path.resolve("./config/lib/event_system.js")),
    db = require(path.resolve('./config/lib/sequelize')).models,
    Sequelize = require('sequelize'),
    DBModel = db.login_data,
    winston = require('winston'),
    Joi = require("joi");

const db_t = require(path.resolve('./config/lib/sequelize'));
const  { Op } = require('sequelize');

/**
 * @api {post} /api/customerdata Create Customer
 * @apiVersion 0.2.0
 * @apiName Create Customer
 * @apiGroup Backoffice
 * @apiHeader {String} authorization Token string acquired from login api.
 * @apiParam {Number} group_id  Mandatory field group_id.
 * @apiParam {String} firstname  Mandatory field firstname.
 * @apiParam {String} lastname  Mandatory field lastname.
 * @apiParam {String} email  Mandatory field email.
 * @apiParam {String} address  Mandatory field address.
 * @apiParam {String} city  Mandatory field city.
 * @apiParam {String} country  Mandatory field country.
 * @apiParam {String} telephone  Mandatory field telephone.
 * @apiSuccess (200) {String} message Record created successfuly
 * @apiError (40x) {String} message Error message on creating customer data.
 */


exports.create_customer_with_login = function (req, res) {

    var validate_pin = req.body.pin;

    if ((`${validate_pin}`.length < 4) || (`${validate_pin}`.length > 4)){
        return res.status(400).send({message: "PIN must have 4 numbers"});
    }
    else {
        res.status(200);
    }

    req.body.company_id = req.token.company_id; //save record for this company
    var limit = req.app.locals.backendsettings[req.token.company_id].asset_limitations.client_limit; //number of client accounts that this company can create
    if ((req.body.username) && (req.body.email)) {
        req.body.username = req.body.username.toLowerCase();
        req.body.email = req.body.email.toLowerCase();
        req.body.country = req.body.country.trim();

        saas_functions.check_limit('login_data', limit).then(function (limit_reached) {
            if (limit_reached === true) return res.status(400).send({message: "You have reached the limit number of client accounts you can create for this plan. "});
            else {
                customerFunctions.create_customer_with_login(req, res).then(function (data) {


                    if (data.message.dataValues) {
                        //data = Object.assign(req.body, data.message.dataValues);
                        let customer_data = {...req.body, ...data.message.dataValues}
                        eventSystem.emit(req.token.company_id, eventSystem.EventType.customer_created, customer_data);
                    }

                    if (data.status) {
                        res.status(200).send({message: data.message});
                    } else {
                        res.status(400).send({message: data.message});
                    }
                });
            }
        }).catch(function (error) {
            winston.error("Error checking for the limit number of client accounts for company with id ", req.token.company_id, " - ", error);
            return res.status(400).send({message: "The limit number of client accounts you can create for this plan could not be verified. Check your log file for more information."});
        });
    } else {
        res.status(400).send("Email address or Username can not be blank.");
        return null
    }

};

/**
 * Show current
 */
exports.read = function(req, res) {
    if(req.loginData.company_id === req.token.company_id) res.json(req.loginData);
    else return res.status(404).send({message: 'No data with that identifier has been found'});
};


/**
 * List
 */

exports.list = function(req, res) {

    var qwhere = {},
        final_where = {},
        query = req.query;

    if(query.customer_id) qwhere.customer_id = query.customer_id;
    if(query.login_id) qwhere.id = query.login_id;

    //search client account by username
    if (query.username) qwhere.username = query.username; //full text search
    if (query.q) {
        qwhere = {
            ...qwhere, 
            ...{
                [Op.or]: { username: { [Op.like]: `%${query.q}%` } }
            }
        }
    }

    var customer_data_where = {};
    var emailFilter = req.query['customer_datum.email'];
    var nameFilter = req.query['customer_datum.firstname'];


    if (emailFilter) {
        customer_data_where = {[Op.or]: {email: {[Op.like]: '%' + emailFilter + '%'}}};
    }



    if (nameFilter) {
        customer_data_where = {
            [Op.or]: {
                //db.sequelize.fn("concat",

                where: Sequelize.where(Sequelize.fn("CONCAT", Sequelize.col("firstname")," ", Sequelize.col("lastname")), {
                    [Op.like]: '%' + nameFilter + '%'
                })
            }
        }
    }

    //start building where
    final_where.where = qwhere;
    if(parseInt(query._end) !== -1){
        if(parseInt(query._start)) final_where.offset = parseInt(query._start);
        if(parseInt(query._end)) final_where.limit = parseInt(query._end)-parseInt(query._start);
    }
    if(query._orderBy) final_where.order = [[query._orderBy, query._orderDir]];
    final_where.include = [{model:db.customer_data,required:true, where: customer_data_where}];
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
        res.jsonp(err);
    });
};


/**
 * middleware
 */
exports.dataByID = function(req, res) {

    const getID = Joi.number().integer().required();
    const {error, value} = getID.validate(req.params.customerId);

    if (error) {
        return res.status(400).send({
            message: 'Data is invalid'
        });
    }

    DBModel.findOne({
        where: {
            id: value,
            company_id: req.token.company_id
        },
        include: [{model: db.customer_data}]
    }).then(function(result) {
        if (!result) {
            return res.status(404).send({
                message: 'No data with that identifier has been found'
            });
        } else {
            req.loginData = result;
            res.json(result);
            return null;
        }
    }).catch(function(err) {
        return winston.error("Error at fetching by id, customer account", err);
    });

};


exports.updateClient = async function(req, res){

    try {
        const customer = await db.customer_data.findOne({
            where: {
                email: req.body.customer_datum.email,
                id: {[Op.not]: req.body.customer_datum.id}
            }
        });
        if(customer) {
            return res.status(400).send({message: "Cannot update user because email already exists"});
        }
    } catch (e) {
        winston.error("Error at checking for existing email on update, error: ", e);
        return res.status(400).send({message: "Error at checking for existing email"});
    }

    let validate_pin = req.body.pin;

    if ((`${validate_pin}`.length < 4) || (`${validate_pin}`.length > 4)){
        return res.status(400).send({message: "PIN must have 4 numbers"});
    }
    else {
        res.status(200);
    }

    //login_data record needs to be updated as an instance for the beforeHook to work
    db.login_data.findOne({
        where: {id: req.params.customerId, company_id: req.token.company_id}
    }).then(function (client_instance) {


        return db_t.sequelize.transaction(function (t) {
            req.body.customer_datum.country = req.body.customer_datum.country.trim();
            return db.customer_data.update(
                req.body.customer_datum,
                {
                    where: {id: req.body.customer_datum.id},
                    transaction: t
                }
            ).then(function (updated_customer) {

                return client_instance.update(req.body, {where: {id: req.params.customerId}, transaction: t});
            });
        }).then(function (result) {

            var qdata = req.body.customer_datum;
            result.dataValues = Object.assign(result.dataValues, qdata);


            // Transaction has been committed
            eventSystem.emit(req.token.company_id, eventSystem.EventType.customer_updated, result);
            return res.jsonp({status: 200, message: "Customer updated successfully"});
        }).catch(function (error) {
            // Transaction has been rolled back
            return res.status(400).send({message: "Error updating customer - " + error.errors[0].message});
        });
    }).catch(function (error) {
        // Transaction has been rolled back
        return res.status(400).send({message: "Error updating customer"});
    });


};