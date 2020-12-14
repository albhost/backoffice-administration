
"use strict";

var path = require('path');
var crypto = require("crypto");
const db = require(path.resolve('./config/lib/sequelize')),
  models = db.models;
const winston = require(path.resolve('./config/lib/winston'));

const pallyconConfig = require('../../../../../config/pallycon.json');

module.exports = {
  encrypt: function encrypt(data) {
    if (!data)
      return 'fail';

    // default customdata for DEMO playback
    if (pallyconConfig.SITE_ID == 'DEMO' && !pallyconConfig.SITE_KEY)
      return 'cceAN+NNUg/sNW3EPc1mWV4yoPiPEnhI0Ue83L20peFvUyCXapArdCkqmjgsRW8c6b6P+U+1fBqUuhBOIza14SaXYKv04ZfLhYupEBKpGis=';

    var cipher = crypto.createCipheriv('aes-256-cbc', pallyconConfig.SITE_KEY, pallyconConfig.AES256_IV);
    //cipher.setAutoPadding(false);
    var result = cipher.update(data, "utf8", "base64");
    result += cipher.final("base64");

    return result;
  },
  decrypt: function decrypt(data) {
    if (!data)
      return 'fail';

    var decipher = crypto.createDecipheriv('aes-256-cbc', pallyconConfig.SITE_KEY, pallyconConfig.AES256_IV);
    //cipher.setAutoPadding(false);
    var result = decipher.update(data, "base64", "utf8");
    result += decipher.final("utf8");

    return result;
  },
  getConfig: function getConfig() {
    //winston.info('[getConfig] ' + JSON.stringify(config));
    return pallyconConfig;
  },
  getAPIType: function getAPIType() {
    //console.log('[getAPIType] ' + config.API_TYPE);
    return pallyconConfig.API_TYPE;
  },
  checkContent: async (cid) => {
    return models.channels.findOne({
      attributes: ['id', 'title'],
      where: { id: cid }
    })
      .then(channel => Promise.resolve(channel))
      .catch(err => Promise.reject(null));
  }
};
