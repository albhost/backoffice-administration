'use strict'

const epgController = require('../controllers/epg.server.controller'),
  authMiddleware = require('../middlewares/auth.middleware.server.controller');

module.exports = function (app) {
  app.route('/apiv4/epg/data')
    .all(authMiddleware.requireToken)
    .get(epgController.getEpgData);

  app.route('/apiv4/catchup/data')
    .all(authMiddleware.requireToken)
    .get(epgController.getCatchupEpg);

  app.route('/apiv4/catchup/stream')
    .all(authMiddleware.requireToken)
    .get(epgController.getCatchupStream);
}
