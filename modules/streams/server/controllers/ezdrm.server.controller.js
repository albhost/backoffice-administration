'use strict'

var path = require('path'),
    queryString = require('querystring'),
    responses = require(path.resolve("./config/responses.js"));
const axios = require('axios').default;

exports.authorize = function(req, res) {
    let response = `Play=True
    Persist=False
    Rental_Duration=0
    License_Duration=0`

    res.type('text/html');
    res.send(response);
}

exports.extractAuth = function(req, res, next) {
    if (!req.query.CustomData) {
        let response = "Play=False";
        res.type('text/html');
        res.send(response);
        return;
    }

    req.headers.auth = req.query.CustomData;
    next();
}

exports.issueLicense = function(req, res) {
    let cid = req.params.cid;
    let response = new responses.OK()

    if (!cid) {
        response.error_description = 'Content id was not specified';
        res.status(400).send(response);
        return;
    }

    let config = req.app.locals.advanced_settings[req.authParams.companyId].ezdrm;

    let params = {
        U: config.username,
        P: config.password,
        C: cid
    };

    let url = 'http://wvm.ezdrm.com/ws/LicenseInfo.asmx/GenerateKeys?' + queryString.encode(params);

    axios.get(url).then((response) => {
        res.type('application/xml');
        res.send(response.data);
    }).catch(error => {
        response.error_description  = error;
        res.status(500).send(response);
    })
}