'use strict'

var policy = require('../policies/mago.server.policy'),
    vmxCtl = require('../controllers/vmx.server.controller');

module.exports = function (app) {
    app.route('/api/vmx/enable')
        .all(policy.Authenticate)
        .all(policy.isAllowed)
        .post(vmxCtl.enableVmx);

    app.route('/api/vmx/check')
        .all(policy.Authenticate)
        .all(policy.isAllowed)
        .get(vmxCtl.checkVmxAvailability);
}