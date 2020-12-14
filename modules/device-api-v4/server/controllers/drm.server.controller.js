'use strict';

const express = require('express');

const bodyParser = require('body-parser');
const crypto = require('crypto');
const axios = require("axios");


const app = express();

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Origin", "https://integration.widevine.com");
  // res.header("Access-Control-Allow-Origin", "https://shaka-player-demo.appspot.com/demo/");
  // res.header("Access-Control-Allow-Origin", "https://www.jwplayer.com");
  // res.header("Access-Control-Allow-Origin", "https://bitmovin.com");
  res.header("Access-Control-Allow-Credentials", true);
  next();
});

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

function generate_signature(message, KEY, IV) {
  let hashed_text = crypto.createHash('sha1').update(message).digest();
  let padding = '';
  if (Buffer.byteLength((hashed_text, 'utf8')) % 16 != 0) {
    for (let i = 0; i < 16 - ((Buffer.byteLength(hashed_text, 'utf8')) % 16); i++) {
      padding += "00";
    }
  }
  let aes_msg = Buffer.concat([hashed_text, Buffer.from(padding, "hex")]);
  let cipher = crypto.createCipheriv('aes-256-cbc', KEY, IV);
  cipher.setAutoPadding(false);
  let crypted = cipher.update(aes_msg, [], 'base64');
  crypted += cipher.final('base64');
  return crypted
}

exports.drmMiddleware = function (req, res, next) {
  let data = "";
  let arrayPayload = [];

  req.on('data', function (chunk) {
    data += chunk;
    arrayPayload.push(chunk);
  })

  req.on('end', function () {
    req.rawBody = data;
    req.rawBody2 = Buffer.concat(arrayPayload);
    next();
  })
}

exports.serveWidevineKey = async function (req, res) {
  const company_id = req.auth.data.company_id || 1;
  const widevineConfig = req.app.locals.advanced_settings[company_id].widevine;

  const KEY = Buffer.from(widevineConfig.key, "hex");
  const IV = Buffer.from(widevineConfig.iv, "hex");
  const PROVIDER = widevineConfig.provider;
  const LICENSE_CONTENT_KEY = widevineConfig.license_content_key;
  let payload;

  let req_CONTENT_ID = req.query.content_id || "";
  let CONTENT_ID = Buffer.from(req_CONTENT_ID).toString('base64');

  if (req.headers["content-length"] === 2) {
    payload = Buffer.from(req.rawBody).toString('base64');
  } else {
    payload = Buffer.from(req.rawBody2).toString('base64');
  }

  const final_object = {
    payload: payload,
    content_id: CONTENT_ID,
    provider: PROVIDER,
    allowed_track_types: "SD_HD",

    use_policy_overrides_exclusively: true,
    policy_overrides: {
      license_duration_seconds: 36000,
      can_play: true,
      can_renew: true
    }
  };


  const message = JSON.stringify(final_object);

  const signature = generate_signature(message, KEY, IV);
  const b = Buffer.from(message);
  const request = b.toString('base64');

  const requestObject = {
    request: request,
    signature: signature,
    signer: PROVIDER
  };

  const options = {
    baseURL: LICENSE_CONTENT_KEY,
    method: 'POST',
    data: requestObject
  };

  try {
    const {data, status} = await axios(options);

    if (status === 200) {
      const response = Buffer.from(JSON.stringify(data.license), 'base64');
      res.write(response);
      res.end();
    } else {
      res.write("error")
      res.end();
    }
  } catch (error) {
    res.write("error")
    res.end();
  }


}
