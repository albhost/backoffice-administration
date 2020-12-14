'use strict';

var path = require('path'),
    policy = require('../policies/mago.server.policy'),
    subscriptions = require(path.resolve('./modules/mago/server/controllers/subscription.server.controller'));

module.exports = function(app) {

    /* ===== subscriptions ===== */
    app.route('/api/subscriptions')
        .all(policy.Authenticate)
        .all(policy.isAllowed)
        .get(subscriptions.list)
        .post(subscriptions.create);

    /* ===== mysubscription resellers ===== */
    app.route('/api/mysubscription')
        .all(policy.Authenticate)
        .all(policy.isAllowed)
        .get(subscriptions.list)
        .post(subscriptions.create);

    app.route('/api/subscriptions/:subscriptionId')
        .all(policy.Authenticate)
        .all(policy.isAllowed)
        .all(subscriptions.dataByID)
        .get(subscriptions.read)
        .put(subscriptions.update)
        .delete(subscriptions.delete);

};
