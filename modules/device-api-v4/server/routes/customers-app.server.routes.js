'use strict';
/**
 * Module dependencies.
 */
const path = require('path'),
  authMiddleware = require('../middlewares/auth.middleware.server.controller'),
  customersAppController = require('../controllers/customers-app.server.controller');


module.exports = function (app) {

  app.route('/apiv4/customer-app/personal-settings')
    .all(authMiddleware.requireToken)
    .get(customersAppController.getPersonalSettings);

  app.route('/apiv4/customer-app/user-data')
    .all(authMiddleware.requireToken)
    .get(customersAppController.getUserData);

  app.route('/apiv4/customer-app/update-user-data')
    .all(authMiddleware.requireToken)
    .put(customersAppController.updateUserData);

  app.route('/apiv4/customer-app/update-user-settings')
    .all(authMiddleware.requireToken)
    .put(customersAppController.updateUserSettings);

  app.route('/apiv4/customer-app/purchases')
    .all(authMiddleware.requireToken)
    .get(customersAppController.getPurchases);

  app.route('/apiv4/customer-app/subscription')
    .all(authMiddleware.requireToken)
    .get(customersAppController.getSubscription);
};
