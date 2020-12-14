'use strict'

const tvShowsCtrl = require('../controllers/tv-shows.server.controller');
const authMiddleware = require('../middlewares/auth.middleware.server.controller');

module.exports = function(app) {
  app.route('/apiv4/tv_shows/list')
    .all(authMiddleware.requireToken)
    .get(tvShowsCtrl.getTvShowList);

  app.route('/apiv4/tv_shows/details/:tvShowId')
    .all(authMiddleware.requireToken)
    .get(tvShowsCtrl.getTvShowDetails);

  app.route('/apiv4/tv_shows/episode/list/:tvShowId/:seasonId')
    .all(authMiddleware.requireToken)
    .get(tvShowsCtrl.getEpisodesList);

  app.route('/apiv4/tv_shows/episode/details/:episodeId')
    .all(authMiddleware.requireToken)
    .get(tvShowsCtrl.getEpisodeDetails);

  app.route('/apiv4/tv_shows/search')
    .all(authMiddleware.requireToken)
    .get(tvShowsCtrl.searchTvShows);
}
