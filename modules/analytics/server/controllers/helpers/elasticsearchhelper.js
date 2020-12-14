'use strict';
var path = require('path'),
    winston = require(path.resolve('./config/lib/winston')),
    querystring=require('querystring');

const { Client } = require('@elastic/elasticsearch')

function getlogtime(){
    var d = new Date();
    return d.getDate() + "-" + d.getMonth() + "-"+ d.getFullYear()+" "+ d.getHours()+":"+ d.getMinutes()+":"+ d.getSeconds();
}

//get ipv4 from ipv6
function getipaddress(theip){
    theip = theip.split(":");
    return theip[3];
}

function trackobject(req, cb) {

    const company_id = req.get("company_id") || 1;
    const elasticClient = new Client({
        node: req.app.locals.advanced_settings[company_id].elastic_stack.url,
        auth: {
            username: req.app.locals.advanced_settings[company_id].elastic_stack.username,
            password: req.app.locals.advanced_settings[company_id].elastic_stack.password
        }
    });

    var payload = {};
    payload.body = req.body;

    const company_name = "magoware";
    payload.index = company_name + "_" + req.body.event;
    if(req.body.event == "screen") {
        //payload.id = req.auth_obj.username + "-" + req.auth_obj.boxid;
    }

    payload.body.ua  = req.headers["user-agent"];    //user agent
    payload.body.username = req.auth_obj.username;        //user ID
    payload.body.cid = req.auth_obj.username + "-" + req.auth_obj.boxid; //user ID
    payload.body.ip = req.ip.replace('::ffff:', '');    // user ip
    payload.body.headers = req.headers;
    payload.body.originaUrl = req.originalUrl;
    payload.body.timestamp = Date.now();

    elasticClient.index(
        payload
    ).then(function (resp) {
        cb();
    }, function (err) {
        console.log(err);
        return cb(new Error('Tracking failed'));
    });
}

exports.trackevent = function(req, res) {
    req.body.event = "event";


    trackobject(req, function (err) {
        if (err) {winston.error(err)}
    });
};

exports.trackscreen = function(req, res) {
    req.body.event = "screen";


    trackobject(req, function (err) {
        if (err) {winston.error(err)}
    });
};

exports.tracktiming = function(req, res) {
    req.body.event = "timing";


    trackobject(req, function (err) {
        if (err) {winston.error(err)}
    });
};
