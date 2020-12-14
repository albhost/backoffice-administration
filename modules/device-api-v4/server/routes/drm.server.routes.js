'use strict';

const path = require('path'),
  authMiddleware = require('../middlewares/auth.middleware.server.controller'),
  drmController = require('../controllers/drm.server.controller');


module.exports = function (app) {
  app.route('/apiv4/proxy/tibo')
    .all(authMiddleware.requireToken)
    .all(drmController.drmMiddleware)
    .get(drmController.serveWidevineKey)
    .post(drmController.serveWidevineKey);
};
