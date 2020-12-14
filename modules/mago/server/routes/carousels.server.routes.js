'use strict'

const policy = require('../policies/mago.server.policy'),
  carousels = require('../controllers/carousels.server.controller');

module.exports = function (app) {
  app.route('/api/carousels')
    .all(policy.Authenticate)
    .all(policy.isAllowed)
    .get(carousels.list)
    .post(carousels.create);

  app.route('/api/carousels/:id')
    .all(policy.Authenticate)
    .all(policy.isAllowed)
    .all(carousels.dataByID)
    .get(carousels.read)
    .put(carousels.update)
    .delete(carousels.delete);

    app.route('/api/carousels/channels/:id')
        .all(policy.Authenticate)
        .all(policy.isAllowed)
        .post(carousels.addChannelId)
        .get(carousels.getSelectedChannels);

}