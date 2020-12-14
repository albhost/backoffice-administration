'use strict'

var policy = require('../policies/mago.server.policy'),
    handler = require('../controllers/banners.server.controller');

module.exports = function(app) {
    app.route('/api/banners')
        .all(policy.Authenticate)
        .all(policy.isAllowed)
        .get(handler.list)
        .post(handler.create);

    app.route('/api/banners/:id')
        .all(policy.Authenticate)
        .all(policy.isAllowed)
        .all(handler.dataByID)
        .get(handler.read)
        .put(handler.update)
        .delete(handler.delete);
}