'use strict'

const eventsController = require('../controllers/events.server.controller'),
  authMiddleware = require('../middlewares/auth.middleware.server.controller');

module.exports = function (app) {
  app.route('/apiv4/events/event')
    .all(authMiddleware.requireToken)
    .post(eventsController.event);

  app.route('/apiv4/events/screen')
    .all(authMiddleware.requireToken)
    .post(eventsController.screen);

  app.route('/apiv4/events/timing')
    .all(authMiddleware.requireToken)
    .post(eventsController.timing);
}
