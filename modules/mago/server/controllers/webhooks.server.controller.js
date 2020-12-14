'use strict';

/**
 * Module dependencies.
 */
const path = require('path'),
    errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller')),
    winston = require('winston'),
    db = require(path.resolve('./config/lib/sequelize')).models,
    DBModel = db.webhooks,
    eventSystem = require(path.resolve("./config/lib/event_system.js")),
    redis = require(path.resolve('./config/lib/redis')),
    Joi = require("joi");
const { Op } = require('sequelize');

/**
 * Create
 */
exports.create = function (req, res) {
    if (!req.body.url || !req.body.events) {
        return res.status(400).send({
            error: {
                code: 400,
                message: 'Required parameters like url and event are missing'
            }
        });
    }
    req.body.company_id = req.token.company_id; //create customer under this company


    var allEvents = ["subscription_canceled", "customer_updated", "subscription_created", "customer_created"];
    db.webhooks.findOne({
        attributes: ['id', 'url', 'events'],
        where: {url: req.body.url, company_id: req.body.company_id}
    }).then(function (result) {
        if (result) {
            var eventList = result.events;
            var event = req.body.events;
            var arr = [];
            for (var i = 0; i < eventList.length; i++) {
                let obj = eventList[i];
                arr.push(obj);
            }

            let foundTrue = false;
            for (let k = 0; k < arr.length; k++) {
                if (arr[k] === event) {
                    foundTrue = true;
                }
            }
            if (foundTrue) {
                res.status(409).send( {code: 409, message: 'Event exist'});
            } else {
                arr.push(event);

                var difference = allEvents.filter(x => arr.indexOf(x) === -1);
                //console.log(difference);

                db.webhooks.update({
                        url: req.body.url,
                        company_id: req.body.company_id,
                        enable: 1,
                        events: arr
                    },
                    {where: {id: result.id}}
                ).then(function (result) {
                    addWebhookLogs(req.token.id, 'update_whs', JSON.stringify(result), req.body.company_id)
                    let redisMessage = req.token.company_id + ':' + event + ':subscribe';
                    redis.client.publish('sync_webhook_event', redisMessage);
                    return res.jsonp(result);
                })
            }
            return null;
        } else {
            var event = [];
            event.push(req.body.events)
            db.webhooks.create({
                company_id: req.body.company_id,
                url: req.body.url,
                enable: 1,
                events: event
            }).then(function (result) {
                if (!result) {
                    return res.status(400).send({message: 'fail getting data'})
                } else {
                    addWebhookLogs(req.token.id, 'create_wh', JSON.stringify(result), req.body.company_id)
                    let redisMessage = req.token.company_id + ':' + event + ':subscribe';
                    redis.client.publish('sync_webhook_event', redisMessage);
                    return res.jsonp(result);
                }
            }).catch(function (err) {
                winston.error("Saving the application data failed with error: ", err);
                return res.status(400).send({
                    message: errorHandler.getErrorMessage(err)
                });
            });
        }
        return null;
    }).catch(function (err) {
        winston.error("Getting webhooks data failed with error: ", err);
        return res.status(400).send({
            message: errorHandler.getErrorMessage(err)
        });
    });
};

function addWebhookLogs(user_id, action, details, company_id) {
    db.webhook_logs.create({
        company_id: company_id,
        user_id: user_id,
        action: action,
        details: details
    }).then((result) => {
        return null;
    }).catch((err) => {
        winston.error("Saving webhook logs failed with error: ", err);
        return null;
    });
}

/**
 * Show current
 */
exports.read = function (req, res) {
    if (req.webhooks.company_id === req.token.company_id) res.json(req.webhooks);
    else return res.status(404).send({message: 'No data with that identifier has been found'});
};


/**
 * List
 */
exports.list = function (req, res) {
    var qwhere = {},
        final_where = {},
        query = req.query;

    if (query.q) {
        qwhere = { [Op.or]: { title: { [Op.like]: `%${query.q}%` } } }
    }

    //start building where
    final_where.where = qwhere;
    if (parseInt(query._start)) final_where.offset = parseInt(query._start);
    if (parseInt(query._end)) final_where.limit = parseInt(query._end) - parseInt(query._start);
    if (query._orderBy) final_where.order = [[query._orderBy, query._orderDir]];

    //end build final where

    final_where.where.company_id = 1; //return only records for this company

    DBModel.findAndCountAll(
        final_where
    ).then(function (results) {
        if (!results) {
            return res.status(404).send({
                message: 'No data found'
            });
        } else {
            //res.setHeader("X-Total-Count", results.count);
            for (let i = 0; i < results.rows.length; i++) {
                results.rows[i].events = results.rows[i].events.toString();
            }
            res.json(results.rows);
        }
    }).catch(function (err) {
        winston.error("Getting webhooks list failed with error: ", err);
        res.jsonp(err);
    });
};


/**
 * Update
 */

exports.update = function (req, res) {
    req.body.company_id = req.token.company_id; //create customer under this company

    var allEvents = ["subscription_canceled", "customer_updated", "subscription_created", "customer_created"];
    db.webhooks.findOne({
        attributes: ['id', 'url', 'events'],
        where: {url: req.body.url, company_id: req.body.company_id}
    }).then(function (result) {
        if (result) {
            var eventList = result.events;
            var event = req.body.events;
            var arr = [];
            for (var i = 0; i < eventList.length; i++) {
                let obj = eventList[i];
                arr.push(obj);
            }

            let foundTrue = false;
            for (let k = 0; k < arr.length; k++) {
                if (arr[k] === event) {
                    foundTrue = true;
                }
            }
            if (foundTrue) {
                res.status(409).send( {code: 409, message: 'Event exist'});
            } else {
                arr.push(event);

                var difference = allEvents.filter(x => arr.indexOf(x) === -1);
                //console.log(difference);

                db.webhooks.update({
                        url: req.body.url,
                        company_id: req.body.company_id,
                        enable: 1,
                        events: arr
                    },
                    {where: {id: result.id}}
                ).then(function (result) {
                    addWebhookLogs(req.token.id, 'update_wh', JSON.stringify(req.body), req.body.company_id)
                    let redisMessage = req.token.company_id + ':' + event + ':subscribe';
                    redis.client.publish('sync_webhook_event', redisMessage);
                    return res.jsonp(result);
                })
            }
            return null;
        }
        return null;
    }).catch(function (err) {
        winston.error("Getting webhooks data failed with error: ", err);
        return res.status(400).send({
            message: errorHandler.getErrorMessage(err)
        });
    });

};


/**
 * Delete
 */
exports.delete = function (req, res) {
    var deleteData = req.webhooks;

    DBModel.findByPk(deleteData.id).then(function (result) {
        if (result) {
            if (result && (result.company_id === req.token.company_id)) {
                addWebhookLogs(req.token.id, 'delete_wh', JSON.stringify(result), req.body.company_id)
                result.destroy().then(function () {
                    let redisMessage = req.token.company_id + ':' + result.events.join(',') + ':unsubscribe';
                    redis.client.publish('sync_webhook_event', redisMessage);
                    return res.json(result);
                }).catch(function (err) {
                    winston.error("Deleting webhooks failed with error: ", err);
                    return res.status(400).send({
                        message: errorHandler.getErrorMessage(err)
                    });
                });
            } else {
                return res.status(400).send({message: 'Unable to find the Data'});
            }
        } else {
            return res.status(400).send({
                message: 'Unable to find the Data'
            });
        }
        return null;
    }).catch(function (err) {
        winston.error("Finding webhooks failed with error: ", err);
        return res.status(400).send({
            message: errorHandler.getErrorMessage(err)
        });
    });

};

/**
 * Get all type events possible
 */
exports.getEventTypes = function (req, res) {

    res.send(eventSystem.EventTypes);
}

/**
 * middleware
 */
exports.dataByID = function (req, res, next) {

    const getID = Joi.number().integer().required();
    const {error, value} = getID.validate(req.params.webhooksId);

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
            req.webhooks = result;
            next();
            return null;
        }
    }).catch(function (err) {
        winston.error("Finding subscription data failed with error: ", err);
        return res.status(500).send({
            message: 'Error at getting webhooks data'
        });
    });

};