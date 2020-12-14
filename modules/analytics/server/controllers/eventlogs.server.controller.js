'use strict';
var path = require('path'),
    vod = require(path.resolve("./modules/deviceapiv2/server/controllers/vod.server.controller.js"));
var winston = require("winston");

var thistracker = require(path.resolve('./modules/analytics/server/controllers/helpers/matomoanalyticshelper'));
var googletracker = require(path.resolve('./modules/analytics/server/controllers/helpers/googleanalyticshelper'));
var elastictracker = require(path.resolve('./modules/analytics/server/controllers/helpers/elasticsearchhelper'));

exports.event = function(req, res) {

    res.setHeader('cache-control', 'no-store');
    if(req.body.event_category === 'vod' && req.body.event_action === 'movie start') vod.add_click(req.body.event_label); //increment clicks for a movie everythime it plays

    const isDevelopMode = process.env.NODE_ENV === 'development';
    if(isDevelopMode) return res.send('ok');
    else {
    var event_value = req.body.event_value;
    var event_label = req.body.event_label;
    vod.getEventValue(req, event_value, event_label);
    googletracker.trackevent(req,res);
    elastictracker.trackevent(req,res);
    res.send('ok');
    }
};

exports.screen = function (req, res) {
    const isDevelopMode = process.env.NODE_ENV === 'development';
    if (isDevelopMode) return res.send('ok');
    else {
        res.setHeader('cache-control', 'no-store');
        googletracker.trackscreen(req, res);
        elastictracker.trackscreen(req, res);

        res.send('ok');
    }
};

exports.timing = function (req, res) {
    const isDevelopMode = process.env.NODE_ENV === 'development';
    if (isDevelopMode) return res.send('ok');
    else {
        res.setHeader('cache-control', 'no-store');
        googletracker.tracktiming(req, res);
        elastictracker.tracktiming(req, res);

        res.send('ok');
    }
};
