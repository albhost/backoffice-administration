"use strict";

const winston = require('winston');
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, colorize, printf, prettyPrint } = format;

const myFormat = printf(({ level, message, timestamp, stack }) => {
  let stackError = stack ? stack : '';
  return `${timestamp} - ${level}: ${message} \n ${stackError}`;
});

const logger = winston.createLogger({
  transports: [
    new winston.transports.Console({
      level: (process.env.NODE_ENV === 'development') ? 'verbose' : 'error',
      format: combine(
        timestamp(),
        colorize(),
        myFormat
        //prettyPrint()
      )
    }),
    new winston.transports.File({
      filename: 'errors.log',
      level: 'error',
      format: combine(
        timestamp(),
        prettyPrint()
      )
    })
  ]
});

logger.stream = {
  write: function(message, encoding) {
    logger.info(message);
  }
};
winston.add(logger);
/* var logger = new(winston.Logger)();

logger.add(winston.transports.Console, {
  level: (process.env.NODE_ENV === 'development')?'verbose':'error',
  prettyPrint: true,
  colorize: true,
  silent: false,
  timestamp: true
});

logger.add(winston.transports.File, {
  filename: 'errors.log',
  level: 'error',
  prettyPrint: true,
  colorize: true,
  silent: false,
  timestamp: true
});



logger.stream = {
  write: function(message, encoding) {
    logger.info(message);
  }
}; */
module.exports = logger;
