'use strict'

var path = require('path'),
    customerApiHandler = require(path.resolve('./modules/public-api/server/controllers/customer.server.controller.js')),
    policy = require(path.resolve('./modules/mago/server/policies/mago.server.policy.js')),
    subscriptionApiHandler = require(path.resolve('./modules/public-api/server/controllers/subscription.server.controller.js')),
    epgController = require(path.resolve('./modules/public-api/server/controllers/public.epgdata.server.controller.js')),
    comboApiHandler = require(path.resolve('./modules/public-api/server/controllers/combo.server.controller.js')),
    companyApiHandler = require(path.resolve('./modules/public-api/server/controllers/company.server.controller.js')),
    devicesApiHandler = require(path.resolve('./modules/public-api/server/controllers/devices.server.controller.js')),
    chargebeeApiHandler = require(path.resolve('./modules/public-api/server/controllers/chargebee.server.controller.js'));

module.exports = function(app) {

    //verify if token is valid.
    /**
     * @api {get} /api/public/verify Verifies if token is valid
     * @apiVersion 0.2.0
     * @apiName Verify Token
     * @apiGroup Login
     * @apiParam (Query parameters) {String} apikey Authorization key as query parameter
     * @apiSuccess {String} data.message Message
     * @apiError {Number} error.code Code
     * @apiError {String} error.message Message description of error
     */
    app.route('/api/public/verify')
        .all(policy.isApiKeyAllowed)
        .get(function (req, res) {
            res.send({message:'success'});
        });

    app.route('/api/public/customer')
        .all(policy.isApiKeyAllowed)
        .get(customerApiHandler.listCustomers)
        .post(customerApiHandler.createCustomer);

    app.route('/api/public/customer/:username')
        .all(policy.isApiKeyAllowed)
        .get(customerApiHandler.getCustomer)
        .put(customerApiHandler.updateCustomer)
        .post(customerApiHandler.updateCustomer);

    app.route('/api/public/subscription')
        .all(policy.isApiKeyAllowed)
        .post(subscriptionApiHandler.addSubscription)
        .put(subscriptionApiHandler.cancelSubscription)
        .post(subscriptionApiHandler.cancelSubscription)
        .get(subscriptionApiHandler.listSubscription);

    app.route('/api/public/packages')
        .all(policy.isApiKeyAllowed)
        .get(subscriptionApiHandler.listPackages);


    app.route("/api/public/customer/salesreport/:username")
        .all(policy.isApiKeyAllowed)
        .get(subscriptionApiHandler.getCustomerSalesreport);

    app.route('/api/public/customer/package/:username')
        .all(policy.isApiKeyAllowed)
        .get(subscriptionApiHandler.getCustomerPackages)

    app.route('/api/public/combo')
        .all(policy.isApiKeyAllowed)
        .get(comboApiHandler.getCombos);

    app.route('/api/public/devices/:username')
        .all(policy.isApiKeyAllowed)
        .post(devicesApiHandler.updateDevices)
        .put(devicesApiHandler.updateDevices);

    app.route('/api/public/userDevices/:username')
        .all(policy.isApiKeyAllowed)
        .get(devicesApiHandler.getUserDevices);

    app.route('/api/public/company')
        .all(policy.isApiKeyAllowed)
        .all(policy.isSuperadmin)
        .get(companyApiHandler.getCompanies)
        .post(companyApiHandler.createCompany)

    app.route('/api/public/company/:id')
        .put(companyApiHandler.updateCompany)
        .post(companyApiHandler.updateCompany);

    app.route('/api/public/subscription')
        .all(policy.isApiKeyAllowed)
        .post(chargebeeApiHandler.chargebee_subscription_created)

    app.route('/api/public/subscription/:username/last')
        .all(policy.isApiKeyAllowed)
        .get(subscriptionApiHandler.getLastSmallAndBigScreenSubscriptions);

    app.route('/api/public/subscription/status')
        .all(policy.isApiKeyAllowed)
        .get(subscriptionApiHandler.getCustomerSubscriptionStatus);


    /* ---------------------------------------------- EPG Data ---------------------------------------------- */

    //Insert EPG Row
    app.route('/api/public/epg/insert')
        .all(policy.isApiKeyAllowed)
        .post(epgController.insert_epg_row);

}