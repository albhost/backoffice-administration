'use strict'

const packageCtl = require('../controllers/packages.server.controller'),
  authMiddleware = require('../middlewares/auth.middleware.server.controller');

module.exports = function (app) {
  app.route('/apiv4/packages')
    .all(authMiddleware.requireToken)
    .get(packageCtl.getPackagesWithSubscription);

  app.route('/apiv4/packages/:id/channels')
    .all(authMiddleware.requireToken)
    .get(packageCtl.getPackageChannels);
}
