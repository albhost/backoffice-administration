'use strict';
const path = require('path'),
  vod = require(path.resolve("./modules/deviceapiv2/server/controllers/vod.server.controller.js"));

const googleTracker = require(path.resolve('./modules/analytics/server/controllers/helpers/googleanalyticshelper'));
const elasticTracker = require(path.resolve('./modules/analytics/server/controllers/helpers/elasticsearchhelper'));
const isDevelopMode = process.env.NODE_ENV === 'development';

exports.event = function (req, res) {
  if (isDevelopMode) return res.status(200).end();

  res.setHeader('cache-control', 'no-store');
  const {event_category, event_action, event_label, event_value} = req.body
  if (event_category === 'vod' && event_action === 'movie start') vod.add_click(event_label); //increment clicks for a movie everythime it plays

  googleTracker.trackevent(req, res);
  elasticTracker.trackevent(req, res);
  vod.getEventValue(req, event_value, event_label);
  res.send('ok');
};

exports.screen = function (req, res) {
  if (isDevelopMode) return res.status(200).end();

  res.setHeader('cache-control', 'no-store');
  googleTracker.trackscreen(req, res);
  elasticTracker.trackscreen(req, res);
  res.send('ok');
};

exports.timing = function (req, res) {
  if (isDevelopMode) return res.status(200).end();

  res.setHeader('cache-control', 'no-store');
  googleTracker.tracktiming(req, res);
  elasticTracker.tracktiming(req, res);
  res.send('ok');
};
