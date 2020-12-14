'use strict';
const path = require('path'),
    db = require(path.resolve('./config/lib/sequelize')).models,
    authenticationHandler = require(path.resolve('./modules/deviceapiv2/server/controllers/authentication.server.controller')),
    winston = require(path.resolve('./config/lib/winston')),
    saleFunctions = require(path.resolve('./custom_functions/sales.js')),
    customerFunctions = require(path.resolve('./custom_functions/customer_functions.js')),
    logHandler = require(path.resolve('./modules/mago/server/controllers/logs.server.controller')),
    crypto = require('crypto'),
    moment = require('moment');


/*
* @api {post} /apiv2/chargeBee/subsription_created ChargeBee Webhook
* @apiVersion 0.1.0
* @apiName Subscription Created
* @apiGroup ChargeBee
*/
exports.chargebee_subscription_created = function (req, res) {
    let subscription_obj = {};

    if ((req.body.event_type === "subscription_created") || (req.body.event_type === "subscription_renewed") || (req.body.event_type === "subscription_cancelled") || (req.body.event_type === "subscription_renewal_reminder")) {
        subscription_obj.transaction_id = req.body.content.subscription.id;
        subscription_obj.value = req.body.content.subscription.plan_amount;
        subscription_obj.product_id = req.body.content.subscription.plan_id;
        subscription_obj.event_type = req.body.event_type;
        subscription_obj.duration = Math.floor((req.body.content.subscription.current_term_end - req.body.content.subscription.current_term_start) / 86400) ? Math.floor((req.body.content.subscription.current_term_end - req.body.content.subscription.current_term_start) / 86400) : 1;
        subscription_obj.start_date = moment.unix(req.body.content.subscription.current_term_start).format("YYYY-MM-DD hh:mm:ss");
        subscription_obj.end_date = moment.unix(req.body.content.subscription.current_term_end).format("YYYY-MM-DD hh:mm:ss");
        subscription_obj.username = (req.body.content.subscription.cf_subscription_username) ? req.body.content.subscription.cf_subscription_username : req.body.content.customer.cf_username;
    }

    if ((req.body.event_type === "customer_created") || (req.body.event_type === "subscription_created") ) {
        subscription_obj.event_type = req.body.event_type;
        subscription_obj.email = req.body.content.customer.email;
        subscription_obj.lastname = req.body.content.customer.last_name;
        subscription_obj.address = (req.body.content.customer.line1) ? req.body.customer.customer.line1 : "address";
        subscription_obj.city = (req.body.content.customer.city) ? req.body.customer.customer.city : "city";
        subscription_obj.country = (req.body.content.customer.country) ? req.body.customer.customer.country : "country";
        subscription_obj.password = (req.body.content.customer.password) ? req.body.customer.customer.password : "1234";

        subscription_obj.firstname = req.body.content.customer.first_name;
        //subscription_obj.username =  req.body.content.customer.cf_username;
        subscription_obj.salt = authenticationHandler.makesalt();
        subscription_obj.channel_stream_source_id = (req.body.channel_stream_source_id) ? req.body.channel_stream_source_id : 1;
        subscription_obj.vod_stream_source = (req.body.vod_stream_source) ? req.body.vod_stream_source : 1;
        subscription_obj.pin = (req.body.pin) ? req.body.pin : '1234';
    }


    delete req.body;
    req.body = subscription_obj;

    var event_type = req.body.event_type;
    switch (event_type) {
        case 'subscription_created' :
        case 'subscription_renewed' :
        case 'subscription_renewal_reminder' :


            logHandler.add_log(req.token.id, req.ip.replace('::ffff:', ''), 's_created', JSON.stringify(req.body));

            customerFunctions.find_or_create_customer_and_login(req, res)
                .then(function (result) {
                    if (result.status) {
                        saleFunctions.add_subscription_transaction(req, res, 1, req.body.transaction_id, req.body.start_date, req.body.end_date).then(function (result) {
                            if (result.status) {
                                res.send({data: {message: result.message}});
                            } else {
                                res.status(409).send({error: {code: 409, message: result.message}});
                            }
                        }).catch(function (err) {
                            winston.error('Adding subscription failed with error: ', err);
                            res.status(500).send({error: {code: 500, message: 'Internal error'}});
                        });
                    } else {
                        res.status(500).send({error: {code: 500, message: 'Failed to create user'}})
                    }
                }).catch(function (error) {
                winston.error('Create customer failed with error: ' + error)
                res.status(500).send({error: {code: 500, message: 'Internal error'}})
            });
            break;
        /*    case  'customer_created' :
              chargebee_customer_created(req, res);
              break;*/

        case 'subscription_cancelled' :
            chargebee_subscription_cancelled(req, res);
            break;

        default:
            res.send({code: 200, message: "Event type unknown ..."});
            break;

    }
}
function chargebee_subscription_cancelled(req, res) {

    logHandler.add_log(req.token.id, req.ip.replace('::ffff:', ''), 's_cancel', JSON.stringify(req.body));

    db.salesreport.findOne({where: {transaction_id: req.body.transaction_id}})
        .then(function (transaction) {
            if (!transaction) {
                res.status(404).send({error: {code: 404, message: 'Transaction not found'}})
            } else {
                req.body.combo_id = transaction.combo_id;
                db.login_data.findOne({where: {id: transaction.login_data_id}})
                    .then(function (user) {
                        if (user) {
                            req.body.username = user.username;
                            saleFunctions.add_subscription_transaction(req, res, -1, req.body.transaction_id, req.body.start_date, req.body.end_date).then(function (result) {
                                if (result.status) {
                                    res.send({data: {message: result.message}});
                                } else {
                                    res.status(409).send({data: {message: result.message}});
                                }
                            });
                        }
                    });
            }
        })
}

/*function chargebee_customer_created(req, res) {

    logHandler.add_log(req.token.id, req.ip.replace('::ffff:', ''), 'c_created', JSON.stringify(req.body));

    customerFunctions.find_or_create_customer_and_login(req, res)
        .then(function (result) {
            if (result.status) {
                res.send({data: {message: 'User created successfully'}})
            } else {
                res.status(500).send({error: {code: 500, message: 'Failed to create user'}})
            }
        }).catch(function (error) {
        winston.error('Create customer failed with error: ' + error)
        res.status(500).send({error: {code: 500, message: 'Internal error'}})
    });
}*/