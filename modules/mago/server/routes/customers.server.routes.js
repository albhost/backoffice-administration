'use strict';

var passport = require('passport'),
    JwtStrategy = require('passport-jwt').Strategy,
    ExtractJwt = require('passport-jwt').ExtractJwt;

var path = require('path'),
    db = require(path.resolve('./config/lib/sequelize')).models,
    policy = require('../policies/mago.server.policy'),
    customerData = require(path.resolve('./modules/mago/server/controllers/customer_data.server.controller'));


module.exports = function(app) {
    /* ===== customer data ===== */
    app.route('/api/customerdata')
        .all(policy.Authenticate)
        .get(customerData.list);
		
    app.route('/api/customerdata')
        .all(policy.Authenticate)
        .all(policy.isAllowed)
        .post(customerData.create);

    app.route('/api/customerdata/:customerDataId')
        .all(policy.Authenticate)
        .all(customerData.dataByID)
        .get(customerData.read);
		
    app.route('/api/customerdata/:customerDataId')
        .all(policy.Authenticate)
        .all(policy.isAllowed)
        .all(customerData.dataByID)
        .put(customerData.update)
        .delete(customerData.delete);

    app.route('/api/search_customer')
        .all(policy.Authenticate)
        .get(customerData.search_customer);
};
