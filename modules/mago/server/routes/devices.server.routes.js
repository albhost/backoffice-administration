'use strict';

var path = require('path'),
    policy = require('../policies/mago.server.policy'),
    geoipLogic = require(path.resolve('./modules/geoip/server/controllers/geoip_logic.server.controller')),
    devices = require(path.resolve('./modules/mago/server/controllers/devices.server.controller'));


module.exports = function(app) {

    /* ===== devices ===== */
    app.route('/api/devices')
        .all(policy.Authenticate)
        .get(devices.list);

    app.route('/api/devices')
        .all(policy.Authenticate)
        .all(policy.isAllowed)
        .post(devices.create);

    app.route('/api/devices/delete-old')
        .all(policy.Authenticate)
        .all(policy.isAllowed)
        .delete(devices.deleteOld)
    
    app.route('/api/devices/:deviceId')
        .all(policy.Authenticate)
        .all(policy.isAllowed)
        .all(devices.dataByID)
        .get(devices.read)
        .put(devices.update)
        .delete(devices.delete);

    app.route('/api/deleteByYear')
        .get(devices.deleteByYear);

};