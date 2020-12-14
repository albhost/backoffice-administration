'use strict'

var path = require('path'),
    db = require(path.resolve('config/lib/sequelize')).models,
    authenticationHandler = require(path.resolve('./modules/deviceapiv2/server/controllers/authentication.server.controller')),
    customerFunctions = require(path.resolve('./custom_functions/customer_functions.js')),
    winston = require('winston');

const { Sequelize } = require('sequelize');

/**
 * @api {get} /api/public/customer Get Customer List
 * @apiVersion 0.2.0
 * @apiName GetCustomerList
 * @apiGroup Customer
 * @apiParam (Query parameters) {String} apikey Authorization key as query parameter
 * @apiParam (Query params) {Number} Offset where start getting customers
 * @apiSuccess (200) {Object[]} data List of the customers
 * @apiSuccess {Number} id Id of the customer
 * @apiSuccess {String} username Name the of customer
 * @apiSuccess {String} mac_address Mac address of the customer
 * @apiSuccess {Number} pin Pin of the customer
 * @apiSuccess {Boolean} show_adult Rights for adult channels
 * @apiSuccess {String} player Player name
 * @apiSuccess {Number} timezone Timezone
 * @apiSuccess {Boolean} beta_user Force Upgrade
 * @apiSuccess {Boolean} account_lock True if user is not available
 * @apiSuccess {Number} max_login_limit The number of devices customer can simultaneously login. The limit is separately applied for mobile and stb devices
 * @apiSuccess {Object} customer_datum Customer data
 * @apiSuccess {String} customer_datum.firstname First name of the customer
 * @apiSuccess {String} customer_datum.lastname Last name of the customer
 * @apiSuccess {String} customer_datum.email Email of the customer
 * @apiSuccess {String} customer_datum.telephone Telephone of the customer
 * @apiSuccess {String} customer_datum.address Address of the customer
 * @apiSuccess {String} customer_datum.city City
 * @apiSuccess {String} customer_datum.country Country
 * @apiSuccess {Date} customer_datum.updatedAt Time when customer updated
 * @apiSuccess {Number} channel_stream_source_id Live stream id
 * @apiSuccess {Number} vod_stream_source_id Vod stream id
 * @apiError (40x) {Object} error Error-Response
 * @apiError {Number} error.code Code
 * @apiError {String} error.message Message description of error
 * @apiSuccessExample {Json} Success-Response:
 * HTTP/1.1 200 OK
 * {
    "data": [
     {
        "id": 25224,
        "username": "username",
        "createdAt": "2019-12-31T09:51:21.000Z",
        "mac_address": "ACDBDA45DAF457",
        "pin": "1234",
        "show_adult": 0,
        "player": "ExoPlayer",
        "timezone": 1,
        "beta_user": 1,
        "account_lock": 0,
        "max_login_limit": 3,
        "vod_stream_source": 1,
        "channel_stream_source.id": 1
        "customer_datum.firstname": "your_name",
        "customer_datum.lastname": "your_lastname",
        "customer_datum.email": "email@example.com",
        "customer_datum.telephone": "012345",
        "customer_datum.address": "address",
        "customer_datum.city": "Tirane",
        "customer_datum.country": "Albania",
        "customer_datum.updatedAt": "2020-06-26T14:22:52.000Z"
    },
    ]
 * }
 *
 *
 */
exports.listCustomers = function(req, res) {
    let query = {};
    query.attributes = ['id','username','createdAt','mac_address','pin', 'show_adult','player','timezone','beta_user','account_lock', 'max_login_limit', 'channel_stream_source_id', 'vod_stream_source'];
    query.where = {company_id: req.token.company_id};
    query.include = [
        {
            model: db.customer_data,
            attributes:['firstname','lastname','email','telephone','address','city','country','updatedAt'],
            required: true
        }];
    query.limit = 100;
    query.order = [[Sequelize.literal('customer_datum.updatedAt'), 'DESC']]
    query.raw = true;

    if (req.query.offset) {
        let offset = parseInt(req.query.offset);
        if (offset) {
            query.offset = offset;
        }
    }
    db.login_data.findAll(query)
        .then(function(results) {
            res.send(results)
        }).catch(function(err) {
        winston.error("Getting list of accounts failed with error: ", err);
        res.status(500).send({error: {code: 500, message: 'Internal error'}});
    });
}

/**
 * @api {get} /api/public/customer/:username Get Customer
 * @apiVersion 0.2.0
 * @apiName GetCustomer
 * @apiGroup Customer
 * @apiParam (Path parameter) {String} username Username of the user to be updated
 * @apiParam (Query parameters) {String} apikey Authorization key as query parameter
 * @apiSuccess (200) {Object[]} data customer
 * @apiSuccess {Number} id Id of the customer
 * @apiSuccess {String} username Name the of customer
 * @apiSuccess {Date} createdAt Time when customer created
 * @apiSuccess {String} mac_address Mac address of the customer
 * @apiSuccess {Number} pin Pin of the customer
 * @apiSuccess {Boolean} show_adult Rights for adult channels
 * @apiSuccess {String} player Player name
 * @apiSuccess {Number} timezone Timezone
 * @apiSuccess {Boolean} beta_user Force Upgrade
 * @apiSuccess {Boolean} account_lock True if user is not available
 * @apiSuccess {Number} max_login_limit The number of devices customer can simultaneously login. The limit is separately applied for mobile and stb devices
 * @apiSuccess {Object} data.customer_datum Customer data
 * @apiSuccess {String} data.customer_datum.firstname First name of the customer
 * @apiSuccess {String} data.customer_datum.lastname Last name of the customer
 * @apiSuccess {String} data.customer_datum.email Email of the customer
 * @apiSuccess {String} data.customer_datum.telephone Telephone of the customer
 * @apiSuccess {String} data.customer_datum.address Address of the customer
 * @apiSuccess {String} data.customer_datum.city City
 * @apiSuccess {String} data.customer_datum.country Country
 * @apiSuccess {Number} channel_stream_source_id Live stream id
 * @apiSuccess {Number} vod_stream_source_id Vod stream id
 * @apiError (40x) {Object} error Error-Response
 * @apiError {Number} error.code Code
 * @apiError {String} error.message Message description of error
 * @apiSuccessExample {Json} Success-Response:
 * HTTP/1.1 200 OK
 * {
    "data": [
{
        "id": 22836,
        "username": "username",
        "createdAt": "2019-12-31T09:51:21.000Z",
        "mac_address": "ACDBDA45DAF457",
        "pin": "1234",
        "show_adult": 0,
        "player": "exoplayer",
        "timezone": 2,
        "beta_user": 1,
        "account_lock": 0,
        "max_login_limit": 3,
        "customer_datum.firstname": "your_name",
        "customer_datum.lastname": "your_lastname",
        "customer_datum.email": "email@example.com",
        "customer_datum.telephone": "0000",
        "customer_datum.address": "address1",
        "customer_datum.city": "Tirane",
        "customer_datum.country": " Albania",
        "vod_stream_source.id": 1
        "channel_stream_source.id": 1
    }
    ]
 * }
 *
 *
 */
exports.getCustomer = function(req, res) {
    let username = req.params.username
    if (username) {
        db.login_data.findOne({
            attributes: ['id', 'username', 'createdAt','mac_address','pin', 'show_adult','player','timezone','beta_user','account_lock', 'max_login_limit', 'channel_stream_source_id', 'vod_stream_source'],
            where: {username: username, company_id: req.token.company_id},
            include: [{
                model: db.customer_data,
                //attributes:['firstname','lastname','email','telephone','address','city','country'],
                required: true
            }],
            raw: true
        }).then(function(customer) {
            if (customer) {
                res.send({data: customer});
            } else {
                res.status(404).send({error: {code: 404, message: 'Customer not found'}});
            }
        }).catch(function(err) {
            winston.error('Getting customer failed with error: ', err);
            res.status(500).send({error: 500, message: 'Internal error'});
        });
    }
    else {
        res.status(400).send({error: {code: 400, message: 'Parameter username missing'}})
    }
}

/**
 * @api {put} /api/public/customer/:username Update Customer
 * @apiVersion 0.2.0
 * @apiName UpdateCustomer
 * @apiGroup Customer
 * @apiParam (Path parameter) {String} username Username of the user to be updated
 * @apiParam (Query parameters) {String} apikey Authorization key as query parameter
 * @apiParam {String} [firstname] First name of the customer
 * @apiParam {String} [lastname]  Last name of the customer
 * @apiParam {String} [password]  Password of the customer
 * @apiParam {String} [email]  Email of the customer
 * @apiParam {String} [address]  Address of customer
 * @apiParam {String} [city]  City
 * @apiParam {String} [country]  Country
 * @apiParam {String} [telephone] Telephone of the country
 * @apiParam {String} [mac_address] Mac address of the customer
 * @apiParam {Number} [pin] Pin of the customer
 * @apiParam {Boolean} [show_adult] Rights for adult channels
 * @apiParam {String} [player] Player name
 * @apiParam {Number} [timezone] Timezone
 * @apiParam {Boolean} [beta_user] Force Upgrade
 * @apiParam {Boolean} [account_lock] True if user is not available
 * @apiParam {Number} [max_login_limit] The number of devices customer can simultaneously login. The limit is separately applied for mobile and stb devices
 * @apiParam {Number} [channel_stream_source_id] Live stream id
 * @apiParam {Number} [vod_stream_source] Vod stream id
 * @apiSuccess (200) {Object[]} data Response
 * @apiSuccess {String} data.message Message
 * @apiError (40x) {Object} error Error-Response
 * @apiError {Number} error.code Code
 * @apiError {String} error.message Message description of error
 */
exports.updateCustomer = function(req, res) {
    if (req.params.username) {
        if (req.body.username) {
            delete req.body.username;
        }

        db.login_data.findOne({
            where:{username: req.params.username}
        }).then(function(login_data) {
            if (!login_data) {
                res.status(404).send({error: {code: 404, message: 'User not found'}});
                return;
            }

            login_data.update(req.body).then(function() {
                db.customer_data.update(req.body, {where: {id: login_data.customer_id}})
                    .then(function(result) {
                        res.send({data: {message: 'Customer updated'}});
                    }).catch(function(error) {
                    winston.error('Update customer failed with error: ', error);
                    res.status(500).send({error: {code: 500, message: 'Internal error'}})
                });
            })
            return null;
        }).catch(function(error) {
            winston.error('Database action failed with error: ', error);
            res.status(500).send({error: {code: 500, message: 'Internal error'}});
        })

    } else {
        res.status(400).send({error: {code: 400, message: 'Parameter username missing'}})
    }
}



/**
 * @api {post} /api/public/customer/:username Update Customer
 * @apiVersion 0.2.0
 * @apiName UpdateCustomer
 * @apiGroup Customer
 * @apiParam (Path parameter) {String} username Username of the user to be updated
 * @apiParam (Query parameters) {String} apikey Authorization key as query parameter
 * @apiParam {String} [firstname] First name of the customer
 * @apiParam {String} [lastname]  Last name of the customer
 * @apiParam {String} [password]  Password of the customer
 * @apiParam {String} [email]  Email of the customer
 * @apiParam {String} [address]  Address of customer
 * @apiParam {String} [city]  City
 * @apiParam {String} [country]  Country
 * @apiParam {String} [telephone] Telephone of the country
 * @apiParam {String} [mac_address] Mac address of the customer
 * @apiParam {Number} [pin] Pin of the customer
 * @apiParam {Boolean} [show_adult] Rights for adult channels
 * @apiParam {String} [player] Player name
 * @apiParam {Number} [timezone] Timezone
 * @apiParam {Boolean} [beta_user] Force Upgrade
 * @apiParam {Boolean} [account_lock] True if user is not available
 * @apiParam {Number} [max_login_limit] The number of devices customer can simultaneously login. The limit is separately applied for mobile and stb devices
 * @apiParam {Number} [channel_stream_source_id] Live stream id
 * @apiParam {Number} [vod_stream_source] Vod stream id
 * @apiSuccess (200) {Object[]} data Response
 * @apiSuccess {String} data.message Message
 * @apiError (40x) {Object} error Error-Response
 * @apiError {Number} error.code Code
 * @apiError {String} error.message Message description of error
 */
exports.updateCustomer = function(req, res) {
    if (req.params.username) {
        if (req.body.username) {
            delete req.body.username;
        }

        db.login_data.findOne({
            where:{username: req.params.username}
        }).then(function(login_data) {
            if (!login_data) {
                res.status(404).send({error: {code: 404, message: 'User not found'}});
                return;
            }

            login_data.update(req.body).then(function() {
                db.customer_data.update(req.body, {where: {id: login_data.customer_id}})
                    .then(function(result) {
                        res.send({data: {message: 'Customer updated'}});
                    }).catch(function(error) {
                    winston.error('Update customer failed with error: ', error);
                    res.status(500).send({error: {code: 500, message: 'Internal error'}})
                });
            })
            return null;
        }).catch(function(error) {
            winston.error('Database action failed with error: ', error);
            res.status(500).send({error: {code: 500, message: 'Internal error'}});
        })

    } else {
        res.status(400).send({error: {code: 400, message: 'Parameter username missing'}})
    }
}


/**
 * @api {post} /api/public/customer Create Customer
 * @apiVersion 0.2.0
 * @apiName CreateCustomer
 * @apiGroup Customer
 * @apiParam (Query parameters) {String} apikey Authorization key as query parameter
 * @apiParam {String} firstname First name of the customer
 * @apiParam {String} lastname  Last name of the customer
 * @apiParam {String} username  Username of the customer
 * @apiParam {String} password  Password of the customer
 * @apiParam {String} email  Email of the customer
 * @apiParam {String} [address]  Address of customer
 * @apiParam {String} [city]  City
 * @apiParam {String} [country]  Country
 * @apiParam {String} [telephone] Telephone of the country
 * @apiParam {String} [mac_address] Mac address of the customer
 * @apiParam {Number} [pin] Pin of the customer
 * @apiParam {Boolean} [show_adult] Rights for adult channels
 * @apiParam {String} [player] Player name
 * @apiParam {Number} [timezone] Timezone
 * @apiParam {Boolean} [beta_user] Force Upgrade
 * @apiParam {Boolean} [account_lock] True if user is not available
 * @apiParam {Number} [max_login_limit] The number of devices customer can simultaneously login. The limit is separately applied for mobile and stb devices
 * @apiParam {Number} [channel_stream_source_id] Live stream id
 * @apiParam {Number} [vod_stream_source_id] Vod stream id
 * @apiSuccess (200) {Object[]} data Response
 * @apiSuccess {String} data.message Message
 * @apiError (40x) {Object} error Error-Response
 * @apiError {Number} error.code Code
 * @apiError {String} error.message Message description of error
 */
exports.createCustomer = function(req, res) {
    if (!req.body.username || !req.body.email || !req.body.password || !req.body.firstname || !req.body.lastname) {
        return res.status(400).send({error: {code: 400, message: 'Required parameters like username, email, password, firstname, lastname are missing'}});
    }

    if (!validateUsername(req.body.username)) {
        return res.status(400).send({error: {code: 400, message: 'Username must be alphanumeric, a-z and 0-9'}});
    }

    req.body.company_id = req.token.company_id; //create customer under this company

    req.body.address = (req.body.address) ? req.body.address : '';
    req.body.city = (req.body.city) ? req.body.city : '';
    req.body.country = req.body.country ? req.body.country : '';
    req.body.telephone = req.body.telephone ? req.body.telephone : '';
    req.body.mac_address = (req.body.mac_address) ? req.body.mac_address : '';
    req.body.show_adult = (req.body.show_adult) ? req.body.show_adult : '';


    req.body.salt = authenticationHandler.makesalt();
    req.body.channel_stream_source_id = (req.body.channel_stream_source_id) ? req.body.channel_stream_source_id : 1;
    req.body.vod_stream_source = (req.body.vod_stream_source) ? req.body.vod_stream_source : 1;
    req.body.pin = (req.body.pin) ? req.body.pin : 1234;

            customerFunctions.find_or_create_customer_and_login(req, res)
                .then(function(result) {
                    if (result.status) {
                        res.send({data: {message: 'User created successfully'}})
                    } else {
                        res.status(500).send({error: {code: 500, message: 'Failed to create user'}})
                    }
                }).catch(function(error) {
                winston.error('Create customer failed with error: ' + error)
                res.status(500).send({error: {code: 500, message: 'Internal error'}})
            });
}


function validateUsername(username) {
    //Regex for Valid Characters i.e. Alphabets and Numbers.
    const regex = /^[a-z0-9]+$/
    const isValid = regex.test(username);
    return isValid ? true : false;
}