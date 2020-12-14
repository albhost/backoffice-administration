'use strict'

var path = require('path'),
    db = require(path.resolve('./config/lib/sequelize')).models,
    saleFunctions = require(path.resolve('./custom_functions/sales.js')),
    sequelize = require('sequelize'),
    winston = require('winston');

const { Op }  = require('sequelize');

/**
 * @api {post} /api/public/subscription Add Subscription
 * @apiVersion 0.2.0
 * @apiName AddSubscription
 * @apiGroup Subscription
 * @apiParam (Query parameters) {String} apikey Authorization key as query parameter
 * @apiParam {String} username Username of the customer
 * @apiParam {String} product_id Product id of that will be subscribed
 * @apiParam {String} type Type can be subscr for subscription or vod
 * @apiParam {String} transaction_id Transaction id
 * @apiParam {Date} [start_date] Subscription start date
 * @apiParam {Date} [end_date] Subscription end_date
 * @apiSuccess (200) {Object[]} data Response
 * @apiSuccess {String} data.message Message
 * @apiError (40x) {Object} error Error-Response
 * @apiError {Number} error.code Code
 * @apiError {String} error.message Message description of error
 */
exports.addSubscription = function (req, res) {

    if (!req.body.username || !req.body.product_id || !req.body.type || !req.body.transaction_id) {
        return res.status(400).send({
            error: {
                code: 400,
                message: 'Username or product id or type or transaction_id parameter missing'
            }
        });
    }

    db.salesreport.findOne({
        where: {transaction_id: req.body.transaction_id, company_id: req.token.company_id}
    }).then(function (sale) {
        if (sale) {
            res.status(409).send({
                error: {
                    code: 409,
                    message: 'Transaction is already processed'
                    }
                });
            return;
        }

        if (req.body.type == 'subscr') {
            let startDate = undefined;

            if (req.body.start_date) {
                startDate = Date.parse(req.body.start_date);
                if (isNaN(startDate)) {
                    res.status(400).send({code: 400, message: 'Start date is invalid'});
                    return;
                }
            }

            saleFunctions.add_subscription_transaction(req, res, 1, req.body.transaction_id, startDate).then(function (result) {
                if (result.status) {
                    res.send({data: {message: result.message}});
                } else {
                    res.status(409).send({error: {code: 409, message: result.message}});
                }
            }).catch(function (err) {
                winston.error('Adding subscription failed with error: ', err);
                res.status(500).send({error: {code: 500, message: 'Internal error'}});
            });

        } else if (req.body.type == 'vod') {
            saleFunctions.buy_movie(req, res, req.body.username, req.body.product_id, req.body.transaction_id).then(function (resul) {
                if (resul.status) {
                    res.send({data: {message: resul.message}});
                } else {
                    res.status(409).send({error: {code: 409, message: resul.message}});
                }
            }).catch(function (err) {
                winston.error('Adding vod subscription failed with error: ', err)
                res.status(500).send({error: 500, message: 'Internal error'});
            });
        }
    })
}


/**
 * @api {get} /api/public/subscription Get Salesreport List
 * @apiName GetSalesreport
 * @apiGroup Subscription
 * @apiParam (Query parameters) {String} apikey Authorization key as query parameter
 * @apiSuccess (200) {Object[]} data Response
 * @apiSuccess {Number} data.id Subscription id
 * @apiSuccess {String} data.user_username User name
 * @apiSuccess {Date} data.saledate Sale date
 * @apiSuccess {Date} data.createdAt Created Date
 * @apiSuccess {Date} data.updatedAt Updated Date
 * @apiSuccess {String} data.username Name of login user
 * @apiSuccess {Number} data.customer_datum.id Customer id
 * @apiSuccess {String} data.customer_datum.email Customer Email
 * @apiSuccess {String} data.combo.product_id Product id
 * @apiSuccess {String} data.combo.name Product Name
 * @apiError (40x) {Object} error Error-Response
 * @apiError {Number} error.code Code
 * @apiError {String} error.message Message description of error
 * @apiSuccessExample {Json} Success-Response:
 * HTTP/1.1 200 OK
 * {
    "data": [
        {
            "id": 40040,
            "user_username": "268650",
            "saledate": "2020-06-23T13:46:09.000Z",
            "createdAt": "2020-05-11T10:57:43.000Z",
            "updatedAt": "2020-06-23T13:46:09.000Z",
            "login_datum.username": "username",
            "login_datum.customer_datum.id": 158444,
            "login_datum.customer_datum.email": "email@expample.com",
            "combo.product_id": "mobile_12_muaj",
            "combo.name": "MOBILE 12 MUAJ"
        },
    ]
 * }
 *
 *
 */


exports.listSubscription = function (req, res){
    db.salesreport.findAll({
        attributes: ['id', 'user_username', 'saledate', 'createdAt', 'updatedAt'],
        where: {company_id: req.token.company_id},
        include: [
            {
                model: db.login_data,
                attributes: ['username'],
                required: true,
                include: [{
                    model: db.customer_data,
                    attributes: ['email'],
                    required: true
                }],
            },
            {  model: db.combo,
                attributes: ['product_id','name'],
                required: true,}
        ],
        limit: 100,
        order: [['updatedAt', 'DESC']],
        raw: true
    }).then(function (results) {
        if (!results) {
            res.status(204).send({data: []});
            return;
        }

        res.json({data: results});
    }).catch(function (err) {
        winston.error('Getting subscription list failed with error: ', err);
        res.status(500).send({error: {code: 500, message: 'Internal error'}});
    });
}



/**
 * @api {put} /api/public/subscription Cancel Subscription
 * @apiName CancelSubscription
 * @apiGroup Subscription
 * @apiParam (Query parameters) {String} apikey Authorization key as query parameter
 * @apiParam {String} transaction_id Transaction id
 * @apiSuccess (200) {Object[]} data Response
 * @apiSuccess {String} data.message Message
 * @apiError (40x) {Object} error Error-Response
 * @apiError {Number} error.code Code
 * @apiError {String} error.message Message description of error
 */
exports.cancelSubscription = function (req, res) {
    if (!req.body.transaction_id) {
        return res.status(400).send({error: {code: 400, message: 'Parameter transaction_id  missing'}})
    }

    db.salesreport.findOne({where: {transaction_id: req.body.transaction_id, company_id: req.token.company_id}})
        .then(function (transaction) {
            if (!transaction) {
                res.status(404).send({error: {code: 404, message: 'Transaction not found'}})
            } else {
                req.body.combo_id = transaction.combo_id;
                db.login_data.findOne({where: {id: transaction.login_data_id}})
                    .then(function (user) {
                        if (user) {
                            req.body.username = user.username;
                            saleFunctions.add_subscription_transaction(req, res, -1, req.body.transaction_id).then(function (result) {
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


/**
 * @api {post} /api/public/subscription Cancel Subscription
 * @apiName CancelSubscription
 * @apiGroup Subscription
 * @apiParam (Query parameters) {String} apikey Authorization key as query parameter
 * @apiParam {String} transaction_id Transaction id
 * @apiSuccess (200) {Object[]} data Response
 * @apiSuccess {String} data.message Message
 * @apiError (40x) {Object} error Error-Response
 * @apiError {Number} error.code Code
 * @apiError {String} error.message Message description of error
 */
exports.cancelSubscription = function (req, res) {
    if (!req.body.transaction_id) {
        return res.status(400).send({error: {code: 400, message: 'Parameter transaction_id  missing'}})
    }

    db.salesreport.findOne({where: {transaction_id: req.body.transaction_id, company_id: req.token.company_id}})
        .then(function (transaction) {
            if (!transaction) {
                res.status(404).send({error: {code: 404, message: 'Transaction not found'}})
            } else {
                req.body.combo_id = transaction.combo_id;
                db.login_data.findOne({where: {id: transaction.login_data_id}})
                    .then(function (user) {
                        if (user) {
                            req.body.username = user.username;
                            saleFunctions.add_subscription_transaction(req, res, -1, req.body.transaction_id).then(function (result) {
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


/**
 * @api {get} /api/public/customer/package/:username Get User Packages
 * @apiName GetUserPackages
 * @apiGroup Subscription
 * @apiParam (Path parameters) {String} username Username of the customer
 * @apiParam (Query parameters) {String} apikey Authorization key as query parameter
 * @apiSuccess (200) {Object[]} data Response
 * @apiSuccess {Date} data.start_date Start date
 * @apiSuccess {Date} data.end_date End date
 * @apiSuccess {String} data.package_name Package Name
 * @apiError (40x) {Object} error Error-Response
 * @apiError {Number} error.code Code
 * @apiError {String} error.message Message description of error
 * @apiSuccessExample {Json} Success-Response:
 * HTTP/1.1 200 OK
 * {
    "data": [
        {
            "start_date": "2020-03-01T00:00:00.000Z",
            "end_date": "2023-03-01T12:00:00.000Z",
            "package.package_name": "Extra Mobile"
        },
    ]
 * }
 *
 *
 */
exports.getCustomerPackages = function (req, res) {
    if (!req.params.username) {
        req.status(400).send({error: {code: 400, message: 'Parameter username missing'}});
        return;
    }

    db.login_data.findOne({where: {username: req.params.username, company_id: req.token.company_id}})
        .then(function (login_data) {
            if (!login_data) {
                res.status(400).send({error: {code: 404, message: 'User not found'}});
                return
            }

            db.subscription.findAll({
                attributes: ['start_date', 'end_date'],
                where: {login_id: login_data.id},
                include: [
                    {
                        model: db.package,
                        attributes: ['package_name'],
                        required: true
                    }
                ],
                order: [['end_date', 'DESC']],
                raw: true
            }).then(function (results) {
                if (!results) {
                    res.status(204).send({data: []});
                    return;
                }

                res.json({data: results});
            }).catch(function (err) {
                winston.error('Getting subscription list failed with error: ', err);
                res.status(500).send({error: {code: 500, message: 'Internal error'}});
            });
        });
}


/**
 * @api {get} /api/public/customer/salesreport/:username Get User Salesreport
 * @apiName GetUserSalesreport
 * @apiGroup Subscription
 * @apiParam (Path parameters) {String} username Username of the customer
 * @apiParam (Query parameters) {String} apikey Authorization key as query parameter
 * @apiSuccess (200) {Object[]} data Response
 * @apiSuccess {Number} data.id Salesreport id
 * @apiSuccess {Number} data.company_id Company id_on_behalf_id
 * @apiSuccess {String} data.transaction_id Transaction id
 * @apiSuccess {Number} data.user_id User id
 * @apiSuccess {Number} data.on_behalf_id On Behalf id
 * @apiSuccess {Number} data.combo_id Combo id
 * @apiSuccess {Number} data.login_data_id User id
 * @apiSuccess {String} data.user_username Username
 * @apiSuccess {String} data.distributorname Distributor name
 * @apiSuccess {Date} data.saledate Sale date
 * @apiSuccess {Boolean} data.active Salesreport active or not
 * @apiSuccess {Date} data.cancelation_date Cancelation Date
 * @apiSuccess {String} data.cancelation_user Cancelation user name
 * @apiSuccess {String} data.cancelation_reason Cancelation reason
 * @apiSuccess {Number} data.value Value of salesreport
 * @apiSuccess {Number} data.duration Duration
 * @apiSuccess {String} data.username Username of login user
 * @apiSuccess {String} data.email User email
 * @apiSuccess {String} data.combo.product_id Product code
 * @apiSuccess {String} data.combo.name Product name
 * @apiSuccess {Date} data.createdAt Created date
 * @apiSuccess {Date} data.updatedAt Updated date
 * @apiError (40x) {Object} error Error-Response
 * @apiError {Number} error.code Code
 * @apiError {String} error.message Message description of error
 * @apiSuccessExample {Json} Success-Response:
 * HTTP/1.1 200 OK
 * {
    "data": [
        {
            "id": 40043,
            "company_id": 1,
            "transaction_id": "nAWEps65M6A5iK/YMtdaOg==",
            "user_id": 1226,
            "on_behalf_id": 8,
            "combo_id": 2001,
            "login_data_id": 6,
            "user_username": "6",
            "distributorname": "administrator",
            "saledate": "2020-05-13T15:28:10.000Z",
            "active": 1,
            "cancelation_date": null,
            "cancelation_user": null,
            "cancelation_reason": null,
            "value": 1,
            "duration": 365,
            "createdAt": "2020-05-13T15:28:10.000Z",
            "updatedAt": "2020-05-13T15:28:10.000Z",
            "login_datum.username": "usernme",
            "login_datum.customer_datum.id": 7,
            "login_datum.customer_datum.email": "email@example.com",
             "combo.product_id": "mobile_free_12_muaj",
            "combo.name": "MOBILE FREE 12 MUAJ"
        },
    ]
 * }
 *
 *
 */
exports.getCustomerSalesreport = function (req, res) {
    if (!req.params.username) {
        res.status(400).send({error: {code: 400, message: 'Parameter username missing'}});
        return;
    }

    db.login_data.findOne({where: {username: req.params.username, company_id: req.token.company_id}})
        .then(function (login_data) {
            if (!login_data) {
                res.status(400).send({error: {code: 404, message: 'User not found'}});
                return
            }

            db.salesreport.findAll({
                where: {
                    login_data_id: login_data.id
                },
                raw: true,
                include: [
                    {
                        model: db.login_data,
                        attributes: ['username'],
                        required: true,
                        include: [{
                            model: db.customer_data,
                            attributes: ['email'],
                            required: true
                        }],
                    },
                    {
                        model: db.combo,
                        attributes: ['product_id', 'name'],
                        required: true

                    }
                ],
                order: [['saledate', 'DESC']]
                //raw: true

            }).then(function (results) {
                if (!results) {
                    res.status(204).send({data: []});
                    return;
                }

                res.json({data: results});
            }).catch(function (err) {
                winston.error('Getting salesreport list failed with error: ', err);
                res.status(500).send({error: {code: 500, message: 'Internal error'}});
            });
        });
}

/**
 * @api {get} /api/public/packages Get Package List
 * @apiName GetPackages
 * @apiGroup Subscription
 * @apiParam (Query parameters) {String} apikey Authorization key as query parameter
 * @apiSuccess (200) {Object[]} data Response
 * @apiSuccess {Number} data.id Package id
 * @apiSuccess {String} data.customer_username Customer Name
 * @apiSuccess {Number} data.login_id Login id
 * @apiSuccess {Number} data.count Count login times
 * @apiSuccess {Date} data.start_date Start date
 * @apiSuccess {Date} data.end_date End date
 * @apiSuccess {Date} data.updatedAt Updated date
 * @apiSuccess {String} data.package_name Package Name
 * @apiSuccess {String} data.username Name of login user
 * @apiSuccess {String} data.id Customer id
 * @apiSuccess {String} data.email Customer email
 * @apiError (40x) {Object} error Error-Response
 * @apiError {Number} error.code Code
 * @apiError {String} error.message Message description of error
 * @apiSuccessExample {Json} Success-Response:
 * HTTP/1.1 200 OK
 * {
    "data": [
        {
            "id": 54802,
            "customer_username": "username",
            "login_id": 23,
            "count": 6,
            "start_date": "2019-08-30T13:49:57.000Z",
            "end_date": "2020-06-21T09:59:59.000Z",
            "updatedAt": "2020-06-22T12:41:13.000Z",
            "package.package_name": "DGA Mobile",
            "login_datum.username": "login_user",
            "login_datum.customer_datum.id": 23,
            "login_datum.customer_datum.email": "email@expample.com"
        },
    ]
 * }
 *
 *
 */
exports.listPackages = function (req, res) {
    db.subscription.findAll({
        attributes: ['id', 'customer_username', 'login_id', [sequelize.fn('count', sequelize.col('login_id')), 'count'], 'start_date', 'end_date', 'updatedAt', [sequelize.fn('max', sequelize.col('end_date')), 'end_date'],],
        where: {company_id: req.token.company_id},
        group: ['login_id'],
        include: [
            {
                model: db.package,
                attributes: ['package_name'],
                required: true
            },
            {
                model: db.login_data,
                required: true,
                attributes: ['username'],
                include: [{
                    model: db.customer_data,
                    attributes: ['email'],
                    required: true
                },]
            },

        ],
        limit: 100,
        order: [['end_date', 'DESC']],
        raw: true
    }).then(function (results) {
        if (!results) {
            res.status(204).send({data: []});
            return;
        }

        res.json({data: results});
    }).catch(function (err) {
        winston.error('Getting subscription list failed with error: ', err);
        res.status(500).send({error: {code: 500, message: 'Internal error'}});
    });
}

/**
 * @apiDeprecated use now (#Subscription:GetCustomerSubscriptionStatus).
 * @api {get} /api/public/subscription/:username/last Get Last Small and Big Screen Subscriptions
 * @apiName GetLastSmallBigScreenSubscriptions
 * @apiGroup Subscription
 * @apiParam (Path parameters) {String} username Username of the customer
 * @apiParam (Query parameters) {String} apikey Authorization key as query parameter
 * @apiSuccess (200) {Object} data Response
 * @apiSuccess {Object} data.live_tv Live Tv
 * @apiSuccess {Object} data.live_tv.small_screen Last small screen subscription
 * @apiSuccess {Number} data.live_tv.small_screen.id Subscription id
 * @apiSuccess {Date} data.live_tv.small_screen.start_date Subscription start date
 * @apiSuccess {Date} data.live_tv.small_screen.end_date Subscription end date
 * @apiSuccess {String} data.live_tv.small_screen.package_name Subscription package name
 * @apiSuccess {Object} data.live_tv.big_screen Last big screen subscription
 * @apiSuccess {Number} data.live_tv.big_screen.id Subscription id
 * @apiSuccess {Date} data.live_tv.big_screen.start_date Subscription start date
 * @apiSuccess {Date} data.live_tv.big_screen.end_date Subscription end date
 * @apiSuccess {String} data.live_tv.big_screen.package_name Subscription package name
 * @apiError (40x) {Object} error Error-Response
 * @apiError {Number} error.code Code
 * @apiError {String} error.message Message description of error
 * @apiSuccessExample {Json} Success-Response:
 * HTTP/1.1 200 OK
 * {
 *     "data": {
 *         "live_tv": {
 *             "small_screen": {
 *                 "id": 21,
 *                 "start_date": "2020-07-06T00:00:00.000Z",
 *                 "end_date": "2021-07-06T00:00:00.000Z",
 *                 "package_name": "Magoware - Mobile"
 *             },
 *            "big_screen": {
 *                 "id": 24,
 *                 "start_date": "2020-07-06T00:00:00.000Z",
 *                 "end_date": "2021-07-06T00:00:00.000Z",
 *                 "package_name": "Many channel test - large screen"
 *             }
 *         }
 *     }
 * }
 */
exports.getLastSmallAndBigScreenSubscriptions = async function(req, res) {
    if (!req.params.username) {
        res.status(400).send({error: {code: 400, message: 'Parameter username missing'}});
        return;
    }

    try {
        let loginData = await db.login_data.findOne({
            attributes: ['id'],
            where: {
                username: req.params.username,
                company_id: req.token.company_id
            }
        });

        if (!loginData) {
            res.status(400).send({error: {code: 400, message: 'No customer account with that username was found'}});
            return;
        }

        let now = new Date();

        let smallScreenSub = await db.subscription.findOne({
            attributes: ['id', 'start_date', 'end_date'],
            where: {
                login_id: loginData.id,
                end_date:  {
                    [Op.gt]: now
                }
            },
            include: [
                {
                    model: db.package,
                    attributes: ['package_name'],
                    where: {package_type_id: 2},
                    required: true
                }
            ],
            order: [['end_date', 'DESC']]
        });

        let bigScreenSub = await db.subscription.findOne({
            attributes: ['id', 'start_date', 'end_date'],
            where: {
                login_id: loginData.id,
                end_date:  {
                    [Op.gt]: now
                }
            },
            include: [
                {
                    model: db.package,
                    attributes: ['package_name'],
                    where: {package_type_id: 1},
                    required: true
                }
            ],
            order: [['end_date', 'DESC']]
        });

        let response = {
            live_tv: {

            }
        }

        if (smallScreenSub) {
            smallScreenSub = smallScreenSub.toJSON();
            smallScreenSub.package_name = smallScreenSub.package.package_name;
            delete smallScreenSub.package;
            response.live_tv.small_screen = smallScreenSub;
        }

        if (bigScreenSub) {
            bigScreenSub = bigScreenSub.toJSON();
            bigScreenSub.package_name = bigScreenSub.package.package_name;
            delete bigScreenSub.package;
            response.live_tv.big_screen = bigScreenSub;
        }

        res.send({data: response});
    }
    catch(err) {
        winston.error("Getting last small and big screen subscriptions failed with error: ", err)
        res.status(500).send({error: {code: 500, message: 'Internal error'}})
    }
}

/**
 * @api {get} /api/public/subscription/status Get Customer Subscription Status
 * @apiName GetCustomerSubscriptionStatus
 * @apiGroup Subscription
 * @apiParam (Query parameters) {String} apikey Authorization key as query parameter
 * @apiParam (Query parameters) {String} username Username of the customer
 * @apiSuccess (200) {Object} data Response
 * @apiSuccess {Object} data.live_tv Live Tv
 * @apiSuccess {Object} data.live_tv.small_screen Last small screen subscription
 * @apiSuccess {Number} data.live_tv.small_screen.id Subscription id
 * @apiSuccess {Date} data.live_tv.small_screen.start_date Subscription start date
 * @apiSuccess {Date} data.live_tv.small_screen.end_date Subscription end date
 * @apiSuccess {String} data.live_tv.small_screen.package_name Subscription package name
 * @apiSuccess {Object} data.live_tv.big_screen Last big screen subscription
 * @apiSuccess {Number} data.live_tv.big_screen.id Subscription id
 * @apiSuccess {Date} data.live_tv.big_screen.start_date Subscription start date
 * @apiSuccess {Date} data.live_tv.big_screen.end_date Subscription end date
 * @apiSuccess {String} data.live_tv.big_screen.package_name Subscription package name
 * @apiError (40x) {Object} error Error-Response
 * @apiError {Number} error.code Code
 * @apiError {String} error.message Message description of error
 * @apiSuccessExample {Json} Success-Response:
 * HTTP/1.1 200 OK
 * {
 *     "data": {
 *         "live_tv": {
 *             "small_screen": {
 *                 "id": 21,
 *                 "start_date": "2020-07-06T00:00:00.000Z",
 *                 "end_date": "2021-07-06T00:00:00.000Z",
 *                 "package_name": "Magoware - Mobile"
 *             },
 *            "big_screen": {
 *                 "id": 24,
 *                 "start_date": "2020-07-06T00:00:00.000Z",
 *                 "end_date": "2021-07-06T00:00:00.000Z",
 *                 "package_name": "Many channel test - large screen"
 *             }
 *         }
 *     }
 * }
 */
exports.getCustomerSubscriptionStatus = async function(req, res) {
    if (!req.query.username) {
        res.status(400).send({error: {code: 400, message: 'Parameter username missing'}});
        return;
    }

    try {
        let loginData = await db.login_data.findOne({
            attributes: ['id'],
            where: {
                username: req.query.username,
                company_id: req.token.company_id
            }
        });

        if (!loginData) {
            res.status(400).send({error: {code: 400, message: 'No customer account with that username was found'}});
            return;
        }

        let now = new Date();

        let smallScreenSub = await db.subscription.findOne({
            attributes: ['id', 'start_date', 'end_date'],
            where: {
                login_id: loginData.id,
                end_date:  {
                    [Op.gt]: now
                }
            },
            include: [
                {
                    model: db.package,
                    attributes: ['package_name'],
                    where: {package_type_id: 2},
                    required: true
                }
            ],
            order: [['end_date', 'DESC']]
        });

        let bigScreenSub = await db.subscription.findOne({
            attributes: ['id', 'start_date', 'end_date'],
            where: {
                login_id: loginData.id,
                end_date:  {
                    [Op.gt]: now
                }
            },
            include: [
                {
                    model: db.package,
                    attributes: ['package_name'],
                    where: {package_type_id: 1},
                    required: true
                }
            ],
            order: [['end_date', 'DESC']]
        });

        let response = {
            live_tv: {

            }
        }

        if (smallScreenSub) {
            smallScreenSub = smallScreenSub.toJSON();
            smallScreenSub.package_name = smallScreenSub.package.package_name;
            delete smallScreenSub.package;
            response.live_tv.small_screen = smallScreenSub;
        }

        if (bigScreenSub) {
            bigScreenSub = bigScreenSub.toJSON();
            bigScreenSub.package_name = bigScreenSub.package.package_name;
            delete bigScreenSub.package;
            response.live_tv.big_screen = bigScreenSub;
        }

        res.send({data: response});
    }
    catch(err) {
        winston.error("Getting last small and big screen subscriptions failed with error: ", err)
        res.status(500).send({error: {code: 500, message: 'Internal error'}})
    }
}