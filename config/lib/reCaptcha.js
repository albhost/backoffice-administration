"use strict";

const config = require('../config');
const winston = require("winston");
const axios = require('axios').default;

// Verify the reCaptcha response
exports.verify = async (response, cb) => {
  try {
    let responseData = await axios({
      method: 'POST',
      url: 'https://www.google.com/recaptcha/api/siteverify',
      data: {
        secret: config.app.reCaptchaSecret,
        response: response
      },
      responseType: 'json'
    })
    if (responseData.status === 200) {
      cb(responseData.data);
    }

    if (cb) cb(null);
  } catch (error) {
    winston.error('reCaptcha error', error);
    cb(error);
  }
};
