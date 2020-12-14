'use strict';
/**
 * Module dependencies.
 */
const path = require('path'),
  winston = require(path.resolve('./config/lib/winston')),
  authMiddleware = require('../middlewares/auth.middleware.server.controller'),
  authv4Controller = require('../controllers/authentication.server.controller'),
  channelsController = require(path.resolve('./modules/deviceapiv2/server/controllers/channels.server.controller'));


module.exports = function (app) {
  app.use('/apiv4', function (req, res, next) {
    winston.info(req.ip.replace('::ffff:', '') + ' # ' + req.originalUrl + ' # ' + JSON.stringify(req.body));
    next();
  });

  app.route('/apiv4/auth/login')
    .all(authMiddleware.requireSignIn)
    .post(authv4Controller.login);

  app.route('/apiv4/auth/token/refresh')
    .post(authMiddleware.refreshToken);

  app.route('/apiv4/auth/company/list')
    .all(authMiddleware.requireSignIn)
    .post(authv4Controller.company_list);

  app.route('/apiv4/channels')
    .all(authMiddleware.requireToken)
    .get(channelsController.list_get);

  app.route('/apiv4/auth/logout')
    .all(authMiddleware.requireToken)
    .post(authv4Controller.logout);

  app.route('/apiv4/auth/logout/all')
    .all(authMiddleware.plainAuth)
    .post(authv4Controller.logoutAllDevices);

  app.route('/apiv4/auth/password/forgot')
    .post(authv4Controller.forgotPassword);

  app.route('/apiv4/auth/password/reset/:token')
    .get(authv4Controller.renderPasswordForm)
    .post(authv4Controller.resetForgottenPassword);

  app.route('/apiv4/auth/password/change')
    .all(authMiddleware.requireToken)
    .post(authv4Controller.changePassword);

  app.route('/apiv4/auth/login-with-token')
    .all(authMiddleware.loginWithToken)
    .post(authv4Controller.loginToken);
};
