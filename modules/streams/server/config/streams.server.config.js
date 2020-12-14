'use strict';

var streamtokens = {
  "AKAMAI": {
    "TOKEN_KEY": "",      // string
    "WINDOW": "",         // number
    "SALT": ""
  },

  "FLUSSONIC": {
    "TOKEN_KEY": "",      // string
    "SALT": "",           // string
    "PASSWORD": "",       // string
    "WINDOW": ""          // number
  },
  "EDGE_CAST": {
    "KEY": "",            // string
    "PROTO_ALLOWED": ""   // string
  },
  "NIMBLE": {
    "DRM_KEY": ""         // string
  },
  "AKAMAISEGMENTMEDIA": {
    "TOKEN_KEY": "",      // string
    "WINDOW": "",         // number
    "SALT": ""
  },
}

/**
 * Module init function.
 */
module.exports = function (app, db) {
  app.locals.streamtokens = streamtokens;
};