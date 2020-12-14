'use strict'
const crypto = require('crypto');
const winston = require("winston");
const path = require('path');
const db = require(path.resolve('./config/lib/sequelize')).models;
const response = require(path.resolve("./config/responses.js"));
const getClientIP = require(path.resolve('./custom_functions/getClientIP'));

const secure_key = process.env.SECURE_KEY; //server side only
const token_valid_time = 96000;         //time window for valid tokens

function generateSha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * @api {get} apiv2/generic/getinternalhashtoken Get hash token
 * @apiVersion 4.0.0
 *
 * @apiName Get hash token
 * @apiGroup Stream key delivery
 *
 * @apiHeader {String} auth Users Authentication token.
 * @apiDescription Implementimi i key delivery per internal encyrption includes the encryption of SHA 256 of:
 *  secure_key + ip + starttime + username (i.e 86c58d6a84d9294249e4f4ea847dcf1344e07402e78ca7de86c4eec7a837a760)
 * @param {string} [startTime] Start time of the request in miliseconds: 1602237403
 *
 * @apiSuccessExample Success-Response:
 *  HTTP/1.1 200 OK
 *     {
 *         "status_code": 200,
 *         "error_code": 1,
 *         "timestamp": 1602246507875,
 *         "error_description": "OK",
 *         "extra_data": "?coid=1&token=bd1ed939e9c47cd273d937f34e0a92e60e90418f981b0eab3e3f122476e6cc46~::1~1602237403~username",
 *         "response_object": []
 *     }
 *
 *
 * @apiErrorExample Error-Response:
 *  HTTP/1.1 500 Internal Server Error
 *   {
 *       "status_code": 888,
 *       "error_code": -1,
 *       "timestamp": 1,
 *       "response_object": []
 *   }
 *
 */
exports.generate_internal_hash_token = function (req, res) {
  try {
    let ip = getClientIP(req);
    let startTime = req.query.startTime || Date.now()
    let username = req.auth_obj.username;
    let data = secure_key + ip + startTime + username;
    const generatedToken = generateSha256(data);
    let token = `?coid=${req.thisuser.company_id}&token=` + generatedToken + "~" + ip + "~" + startTime + "~" + username;

    let response = {
      status_code: 200,
      error_code: 1,
      timestamp: Date.now(),
      error_description: "OK",
      extra_data: token,
      response_object: []
    };

    res.send(response);
  } catch (error) {
    response.send_res(req, res, [], 888, -1, 'ERROR_HASH_DESCRIPTION', 'ERROR_HASH_DESCRIPTION', 'no-store');
  }
};

exports.generate_internal_hash_token_v2 = function (req) {
  try {
    let ip = getClientIP(req);
    let startTime = req.query.startTime || Date.now()
    let username = req.auth_obj.username;
    let data = secure_key + ip + startTime + username;
    const generatedToken = generateSha256(data);

    return `?coid=${req.thisuser.company_id}&token=` + generatedToken + "~" + ip + "~" + startTime + "~" + username;

  } catch (error) {
    winston.error("There was an error with generating internal hash token", error)
    return null;
  }
};

//get request for decryption key test with keyStr: 31313131313131313131313131313131 
exports.generate_internal_key_test = function (req, res) {
  const keyStr = "31313131313131313131313131313131";
  req.auth_obj = {};
  if (req.query.token) {
    let queryobject = req.query.token.split("~");

    //if token has more than three objects
    if (queryobject.length >= 3) {
      let timenow = req.query.starttime || Date.now() / 1000 | 0;

      //if time difference lower than limitatino
      if ((timenow - queryobject[2]) < token_valid_time) {
        let ip = req.query.ip || req.ip.replace('::ffff:', '');
        let username = queryobject[3];
        let thishashvalue = generateSha256(secure_key + ip + queryobject[2] + username);

        if (thishashvalue === queryobject[0]) {
          req.auth_obj.username = username;
          req.auth_obj.description = "success key request";

          let keyBuffer = [];
          //res.writeHead(200, { "Content-Type": "binary/octet-stream", "Pragma": "no-cache" });
          res.set({
            "Content-Type": "binary/octet-stream",
            "Pragma": "no-cache"
          })
          for (let i = 0; i < keyStr.length - 1; i += 2) {
            keyBuffer.push(parseInt(keyStr.substr(i, 2), 16));
          }

          const content = String.fromCharCode(...keyBuffer);

          res.send(content); //deliver decryption key
        } else {

          req.auth_obj.username = username;
          req.auth_obj.description = "invalid key request - hash mismatch";

          winston.error('invalid hash');
          res.send('invalid hash');
        }
      } else {
        req.auth_obj.description = "invalid key request - old token"
        res.send('old request');
      }
    } else {
      req.auth_obj.description = "invalid key request - bad token";
      res.send('bad token');
    }
  } else {
    req.auth_obj.description = "invalid key request - no token";
    res.send('no token');
  }
};


/**
 * @api {get} apiv2/generic/getinternalkey Get internal key
 * @apiVersion 4.0.0
 *
 * @apiName GetInternalKey
 * @apiGroup Stream key delivery
 *
 * @apiHeader {String} auth Users Authentication token.
 * @apiDescription Retrieve the encryption key to play streams
 * @param {string} [startTime] Start time of the request in miliseconds: 1602237403
 * @param {string} token Token retrieved from Get hash token (i.e: ?token=bd1ed939e9c47cd273d937f34e0a92e60e90418f981b0eab3e3f122476e6cc46~::1~1602237403~username)
 * @param {number} coid The id of company of logged user
 *
 * @apiSuccessExample Success-Response:
 *  HTTP/1.1 200 OK
 *     1111111111111111
 *
 * @apiErrorExample Error-Response:
 *  HTTP/1.1 200 Internal Server Error
 *    invalid key request - message
 * 
 * @apiErrorExample Error-Response:
 *  HTTP/1.1 500 Internal Server Error
 *   Error retrieving key: error
 *
 */
//get request for decryption key from database
exports.generate_internal_key = async (req, res, next) => {
  try {
    const companyId = req.query.coid;
    if (!companyId) {
      return res.send('The company id is required!');
    }
    const advancedSettings = await db.advanced_settings.findOne({
      where: { company_id: companyId }
    });

    if (!advancedSettings || !advancedSettings.data.nimble_drm.key) {
      return res.send('Delivery key is not found on database!');
    }

    const keyStr = advancedSettings.data.nimble_drm.key;
    req.auth_obj = {};
    if (req.query.token) {
      let queryobject = req.query.token.split("~");

      //if token has more than three objects
      if (queryobject.length >= 3) {
        let timenow = req.query.starttime || Date.now() / 1000 | 0;

        //if time difference lower than limitatino
        if ((timenow - queryobject[2]) < token_valid_time) {
          let ip = getClientIP(req);
          let username = queryobject[3];
          let thishashvalue = generateSha256(secure_key + ip + queryobject[2] + username);

          if (thishashvalue === queryobject[0]) {
            req.auth_obj.username = username;
            req.auth_obj.description = "success key request";

            let keyBuffer = [];
            //res.writeHead(200, { "Content-Type": "application/octet-stream", "Pragma": "no-cache" });
            res.set({
              "Content-Type": "application/octet-stream",
              "Pragma": "no-cache"
            })
            for (let i = 0; i < keyStr.length - 1; i += 2) {
              keyBuffer.push(parseInt(keyStr.substr(i, 2), 16));
            }

            const content = String.fromCharCode.apply(String, keyBuffer);

            res.end(content); //deliver decryption key
          } else {

            req.auth_obj.username = username;
            req.auth_obj.description = "invalid key request - hash mismatch";


            res.send('invalid hash');
          }
        } else {
          req.auth_obj.description = "invalid key request - old token"
          res.send('old request');
        }
      } else {
        req.auth_obj.description = "invalid key request - bad token";
        res.send('bad token');
      }
    } else {
      req.auth_obj.description = "invalid key request - no token";
      res.send('no token');
    }
  } catch (error) {
    winston.error('invalid hash retrieving key', error);
    next(error)
  }
};



exports.testInternalKey = async (req, res, next) => {
  try {
    const advancedSettings = await db.advanced_settings.findOne({
      where: { company_id: 1 }
    });

    if (!advancedSettings || !advancedSettings.data.nimble_drm.key) {
      return res.send('Delivery key is not found on database!');
    }

    const keyStr = advancedSettings.data.nimble_drm.key || '31313131313131313131313131313131';
    var keyBuffer = [];
    res.writeHead(200, { "Content-Type": "binary/octet-stream", "Pragma": "no-cache" });
    for (var i = 0; i < keyStr.length - 1; i += 2)
      keyBuffer.push(parseInt(keyStr.substr(i, 2), 16));
    var content = String.fromCharCode.apply(String, keyBuffer);
    res.end(content);
  } catch (error) {
    winston.error('invalid hash retrieving key', error);
    next(error)
  }
};