'use strict';

var path = require('path'),
    db = require(path.resolve('./config/lib/sequelize')).models,
    policy = require('../policies/mago.server.policy'),
    notification = require(path.resolve('./modules/mago/server/controllers/notification.server.controller'));


module.exports = function(app) {

    app.route('/api/notification')
        .all(policy.Authenticate)
        .all(policy.isAllowed)
        .get(notification.list)
        .post(notification.create);
};
