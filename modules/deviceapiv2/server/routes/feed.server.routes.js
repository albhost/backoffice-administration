'strict'

const channelAndVodHandler = require('../controllers/feed.server.controller'),
  policy = require('../auth/apiv2.server.auth'),
  bannerHandler = require('../controllers/feed_banners.server.controller');

module.exports = function (app) {
  app.route('/apiv3/feeds/carousels')
    .all(policy.isAllowed)
    .get(channelAndVodHandler.getCarousels)

  app.route('/apiv3/feeds/tv/trending')
    .all(policy.isAllowed)
    .get(channelAndVodHandler.getTrendingChannels)

  app.route('/apiv3/feeds/tv/coming')
    .all(policy.isAllowed)
    .get(channelAndVodHandler.getComingEpg);

  app.route('/apiv3/feeds/tv/channels')
    .all(policy.isAllowed)
    .get(channelAndVodHandler.getFeedChannels);

  app.route('/apiv3/feeds/movies')
    .all(policy.isAllowed)
    .get(channelAndVodHandler.getFeedMovies);

  app.route('/apiv3/feeds/shows')
    .all(policy.isAllowed)
    .get(channelAndVodHandler.getFeedShows);

  app.route('/apiv3/feeds/movies/new')
    .all(policy.isAllowed)
    .get(channelAndVodHandler.getNewArrivals);

  app.route('/apiv3/feeds/movies/paused')
    .all(policy.isAllowed)
    .get(channelAndVodHandler.getFeedPausedMovies);

  app.route('/apiv3/feeds/banners/big')
    .all(policy.decodeAuth)
    .get(bannerHandler.handleGetBigBanners);

  app.route('/apiv3/feeds/banners/small')
    .all(policy.decodeAuth)
    .get(bannerHandler.handleGetSmallBanners);

  // guest APIs are protected with rate limiter
  app.route('/apiv3/guest/feeds/carousels')
    .get(channelAndVodHandler.getCarouselsGuest)

  app.route('/apiv3/guest/feeds/tv/trending')
    .get(channelAndVodHandler.getTrendingChannelsGuest)

  app.route('/apiv3/guest/feeds/tv/coming')
    .get(channelAndVodHandler.getComingEpgGuest);

  app.route('/apiv3/guest/feeds/tv/channels')
    .get(channelAndVodHandler.getFeedChannelsGuest);

  app.route('/apiv3/guest/feeds/movies')
    .get(channelAndVodHandler.getFeedMoviesGuest);

  app.route('/apiv3/guest/feeds/shows')
    .get(channelAndVodHandler.getFeedShowsGuest);

  app.route('/apiv3/guest/feeds/movies/new')
    .get(channelAndVodHandler.getNewArrivalsGuest);
}