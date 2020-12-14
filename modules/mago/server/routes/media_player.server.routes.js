'use strict'

const policy = require('../policies/mago.server.policy'),
  mediaPlayer = require('../controllers/media_player.server.controller');

module.exports = function (app) {
  app.route('/api/mediaplayer')
    .all(policy.Authenticate)
    .all(policy.isAllowed)
    .get(mediaPlayer.list)
    .post(mediaPlayer.create);

  app.route('/api/mediaplayer/:id')
    .all(policy.Authenticate)
    .all(policy.isAllowed)
    .all(mediaPlayer.dataByID)
    .get(mediaPlayer.read)
    .put(mediaPlayer.update)
    .delete(mediaPlayer.delete);
}