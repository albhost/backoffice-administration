'use strict'

const path = require('path');
const winston = require('winston');
const jsonwebtoken = require('jsonwebtoken');
const crypto = require('crypto');

const responseHandler = require("../utils/response");
const tokenConfig = require(path.resolve('./config/jwt.config.json'));

const jwtSecret = process.env.JWT_SECRET_V4 || tokenConfig.jwtSecret;


/**
 * @api {get} /apiv4/token/akamaisegmentmedia/* Get akamai segment media
 * @apiName Akamai
 * @apiGroup Akamai
 * @apiVersion  4.0.0
 *
 * @apiDescription Get akamai segment media by providing JWT token, timestamp and encrypted token.
 * @apiHeader {String} x-access-token User JWT token.
 * @apiHeader {String} timestamp Timestamp of request from client.
 * @apiHeader {String} token The token is the hash(SHA256) string of username​, ​​deviceUUID, ​app_name​ and timestamp (423b4bef309ed88d2165bad035c3ac8e542ca3fce5c65e57b9c36b59a4c2dc74)
 * @apiSuccess (Success 200) {Object} response Response
 *
 * @apiSuccessExample Success-Response:
 * HTTP/1.1 200 OK
 *   {
 *     "token": "?hdnts=ip=::1~st=1596106124~exp=1596136124~acl=*~data=username~hmac=46e6ad16d1fe6d56091d4f9b24a4c87baf8f4b0be02096d4f7747065bdd6a606",
 *   }
 *
 *
 * @apiError (Error 4xx) {Object} error Error
 * @apiError {Number} error.code Code
 * @apiError {String} error.message Message description of error
 */
const requireTokenHashAndTimestamp = async (req, res, next) => {
  try {
    const tokenString = req.header('x-access-token');
    const timestamp = req.header('timestamp');
    const token = req.header('token');

    let jwtToken;
    if (tokenString) {
      const tokenArray = tokenString.split(' ');
      if (tokenArray.length > 0) {
        if (tokenArray[0] !== "Bearer") {
          return responseHandler.sendError(req, res, 401, 24);
        }
        jwtToken = tokenArray[1];
      }
    }

    const decryptedToken = jsonwebtoken.verify(jwtToken, jwtSecret);
    const textToHash = `${decryptedToken.data.username},${decryptedToken.data.device_id},${decryptedToken.data.app_name},${timestamp}`
    const createdHash = crypto.createHash('sha256').update(textToHash, "utf8").digest('hex');
    if (token !== createdHash) {
      return responseHandler.sendError(req, res, 401, 69)
    }

    next()
  } catch (error) {
    winston.error('Decryption of the token failed with error: ', error);
    responseHandler.sendError(req, res, 500, 51);
  }
}


/** The docs below is added only for documentation purposes, the API is on streams/server/controllers/ */

/**
 * @api {get} /apiv2/token/akamaisegmentmedia/* Get akamai segment media v2
 * @apiName AkamaiV2
 * @apiGroup Akamai
 * @apiVersion  4.0.0
 *
 * @apiDescription Get akamai segment media by providing JWT token, timestamp and encrypted token.
 * @apiHeader {String} auth User auth token for API v2.
 * @apiSuccess (Success 200) {Object} response Response
 *
 * @apiSuccessExample Success-Response:
 * HTTP/1.1 200 OK
 *   {
 *     "status_code": 200,
 *     "error_code": 1,
 *     "timestamp": 1,
 *     "error_description": "OK",
 *     "extra_data": "?hdnts=ip=77.242.21.239~st=1598254599~exp=1598263600~acl=*~data=anisa~hmac=8043ae195fd7e92dc80bf81c642c98c8d9833b3e134367110c39cc45deeaf0b6",
 *     "response_object": []
 *   }
 *
 * @apiError (Error 4xx) {Object} error Error
 * @apiError {Number} error.code Code
 * @apiError {String} error.message Message description of error
 */
exports.requireTokenHashAndTimestamp = requireTokenHashAndTimestamp;