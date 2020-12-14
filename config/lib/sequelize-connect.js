"use strict";

var path = require('path');
var config = require('../config');
var winston = require('./winston');

winston.info('Initializing Sequelize...');

var orm = require('./sequelize');

try {
  var models = [];

  config.files.server.models.forEach(function (file) {
    models.push(path.resolve(file));
  });

  orm.discover = models;

  orm.connect(config.db.database, config.db.username, config.db.password, {
    host: config.db.host,
    port: config.db.port,
    dialect: config.db.dialect,
    storage: config.db.storage,
    //logging: config.db.enableSequelizeLog ? winston.verbose : false,
    logging: config.db.enableSequelizeLog ? msg => winston.verbose(msg) : false,
    dialectOptions: {
      supportBigNumbers: true,
      ssl: config.db.ssl ? config.db.ssl : false
    },
    pool: {
      min: 0,
      max: 5,
      idle: 10000
    }
  });
} catch (error) {
  console.log('Error initializing sequelize: ', error);
}