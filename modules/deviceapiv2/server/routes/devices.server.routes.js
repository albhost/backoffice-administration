'use strict';
/**
 * Module dependencies.
 */
const path = require('path'),
  authpolicy = require('../auth/apiv2.server.auth.js'),
  devicesController = require('../controllers/devices.server.controller');

module.exports = function (app) {
  app.route('/apiv3/devices/update/:deviceId')
    .all(authpolicy.isAllowed)
    .put(devicesController.updateMediaPlayer);
};