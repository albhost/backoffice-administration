'use strict'

const vodCtrl = require('../controllers/vod.server.controller');
const authMiddleware = require('../middlewares/auth.middleware.server.controller');

module.exports = function(app) {
  app.route('/apiv4/vod/list')
    .all(authMiddleware.requireToken)
    .get(vodCtrl.getVodList);

  app.route('/apiv4/vod/menu')
    .all(authMiddleware.requireToken)
    .get(vodCtrl.getVodMenu);

  app.route('/apiv4/vod/details/:vodId')
    .all(authMiddleware.requireToken)
    .get(vodCtrl.getMovieDetails);

  app.route('/apiv4/vod/related/:vodId')
    .all(authMiddleware.requireToken)
    .get(vodCtrl.getRelatedMovies);

  app.route('/apiv4/vod/search')
    .all(authMiddleware.requireToken)
    .get(vodCtrl.searchMovies);
}
