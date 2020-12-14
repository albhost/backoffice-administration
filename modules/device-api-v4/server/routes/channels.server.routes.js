'use strict'

const channelCtl = require('../controllers/channels.server.controller'),
  authMiddleware = require('../middlewares/auth.middleware.server.controller'),
  path = require('path'),
  winston = require(path.resolve('./config/lib/winston')),
  streamStore = require(path.resolve('./config/lib/stream_store'));

module.exports = function (app) {
  //Load stream channel in redis
  streamStore.loadAllChannelStreams()
    .then(function () {
      winston.info('Channel streams loaded into Redis')
    })
    .catch(function (err) {
      winston.error(err);
    });

  app.route('/apiv4/channels/list')
    .all(authMiddleware.requireToken)
    .get(channelCtl.getChannelList);

  app.route('/apiv4/channels/search')
    .all(authMiddleware.requireToken)
    .get(channelCtl.searchChannels);

  app.route('/apiv4/channels/:id')
    .all(authMiddleware.requireToken)
    .get(channelCtl.getChannel);

  app.route('/apiv4/channel/favorite')
    .all(authMiddleware.requireToken)
    .post(channelCtl.favoriteChannel)
    .delete(channelCtl.favoriteChannel);

  app.route('/apiv4/channel/osd')
    .all(authMiddleware.requireToken)
    .get(channelCtl.getOsdEpg);

  app.route('/apiv4/channels/favorites/list')
    .all(authMiddleware.requireToken)
    .get(channelCtl.getFavoriteChannelsList);

}
