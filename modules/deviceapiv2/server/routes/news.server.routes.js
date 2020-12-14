'use strict';
/**
 * Module dependencies.
 */
const path = require('path'),
  authpolicy = require('../auth/apiv2.server.auth.js'),
  newsController = require('../controllers/news.server.controller');

module.exports = function (app) {
  app.route('/apiv3/news/list')
    .all(authpolicy.isAllowed)
    .get(newsController.newsList);

  // guest APIs are protected with rate limiter
  app.route('/apiv3/guest/news/list')
    .get(newsController.newsListGuest);
};