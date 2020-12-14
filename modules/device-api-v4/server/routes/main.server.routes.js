'use strict'

const mainController = require('../controllers/main.server.controller'),
  authMiddleware = require('../middlewares/auth.middleware.server.controller'),
  path = require('path');

module.exports = function (app) {
  app.route('/apiv4/main/device-menu')
    .all(authMiddleware.requireToken)
    .get(mainController.deviceMenu);

  app.route('/apiv4/settings')
    .all(authMiddleware.requireToken)
    .get(mainController.settings);
}
