'use strict';
const path = require('path'),
  db = require(path.resolve('./config/lib/sequelize')).models,
  policy = require('../policies/mago.server.policy'),
  streamServer = require(path.resolve('./modules/mago/server/controllers/streams_server.server.controller'));


module.exports = function (app) {
  app.route('/api/streams_server')
    .all(policy.Authenticate)
    .all(policy.isAllowed)
    .get(streamServer.list)
    .post(streamServer.create);

  app.route('/api/streams_server/:streamServerId')
    .all(policy.Authenticate)
    .all(policy.isAllowed)
    .all(streamServer.dataByID)
    .get(streamServer.read)
    .put(streamServer.update)
    .delete(streamServer.delete);
};
