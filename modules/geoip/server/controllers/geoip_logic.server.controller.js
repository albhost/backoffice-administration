'use strict'

const Reader = require('@maxmind/geoip2-node').Reader;
var path = require('path'),
  fs = require('fs-extra'),
  download = require('download'),
  tar = require('tar'),
  winston = require(path.resolve('./config/lib/winston'));
const getClientIP = require(path.resolve('./custom_functions/getClientIP'))
const axios = require('axios').default;
const redisClient = require(path.resolve('./config/lib/redis')).client;

exports.handleGetIPData = function (req, res) {
  let ip = req.query.ip;
  if (!ip) {
    return res.send("Invalid geoip request");
  }

  Reader.open('./public/files/geoip/GeoLite2-City.mmdb')
    .then(function (reader) {
      let geoInfo = reader.city(ip);
      let response = {};
      response.country = geoInfo.country.isoCode;
      response.city = geoInfo.city.names.en;
      response.timezone = geoInfo.location.timeZone;
      redisClient.setex(ip, 3600, JSON.stringify({ status: true, geo_data: response }));
      res.send({ status: true, geo_data: response });
    }).catch(function (error) {
      res.send({ status: false, message: 'Error getting geoip data' })
    });
}


exports.handleGetIPTimezone = async (req, res) => {
  let ip = req.query.ip;
  if (!ip) {
    ip = getClientIP(req);
  }

  fs.readFile('./public/files/geoip/GeoLite2-City.mmdb', async (err, data) => {
    if (err) {
      winston.error("Error reading geoip database, error: ", err);
      return res.send({ status: false, message: 'Error reading the file' });
    };

    try {
      const reader = Reader.openBuffer(data);
      let geoInfo = reader.city(ip);
      if (!geoInfo.location || !geoInfo.location.timeZone) {
        try {
          const response = await resolveTimezoneFormExternalService(ip);
          redisClient.setex(ip, 3600, JSON.stringify({ status: true, geo_data: { timezone: response.timezone } }));
          return res.send({ status: true, geo_data: { timezone: response.timezone } });
        } catch (err_1) {
          return res.send({ status: false, message: err_1 });
        }
      }

      let response = {};
      response.timezone = geoInfo.location.timeZone;
      redisClient.setex(ip, 3600, JSON.stringify({ status: true, geo_data: response }));
      res.send({ status: true, geo_data: response });
    } catch (error) {
      try {
        const response = await resolveTimezoneFormExternalService(ip);
        if (response.error) {
          return res.send({ status: false, message: response.error });
        }
        res.send({ status: true, geo_data: { timezone: response.timezone } });
      } catch (error_1) {
        res.send({ status: false, message: error_1 });
      }
    }
  });
}

exports.middleware = function (req, res, next) {
  const ip = getClientIP(req);

  return Reader.open('./public/files/geoip/GeoLite2-City.mmdb')
    .then(function (reader) {
      let geoInfo = reader.city(ip);
      let response = {};
      response.country = geoInfo.country.isoCode;
      response.city = geoInfo.city.names.en;
      response.timezone = geoInfo.location.timeZone;
      req.geoip = response;
      next()
    }).catch(function (error) {
      req.geoip = {};
      req.geoip.country = "England";
      req.geoip.city = "Greenwich";
      req.geoip.timezone = "Etc/Greenwich";
      next();
    });

};

function resolveTimezoneFormExternalService(ip) {
  return new Promise((resolve, reject) => {
    axios.get('http://worldtimeapi.org/api/ip/' + ip)
      .then(response => {
        resolve(response.data);
      }).catch(err => {
        reject(err);
      })
  });
}

exports.handleDownloadDatabase = async (req, res) => {
  try {
    let url = req.body.url;
    if (!url) {
      return res.send({ status: false, message: "Invalid url" });
    }

    let extension;
    if (url.endsWith('.tar.gz')) {
      extension = '.tar.gz';
    }

    let options = {
      directory: './public/files/geoip/',
      filename: 'GeoLite2-City' + extension
    }

    let data = await download(url);
    fs.writeFileSync(options.directory + options.filename, data);
    winston.info("GEOIP database downloaded");

    let path = options.directory + '/' + options.filename;
    let dbPath;

    tar.x({
      file: path,
      cwd: options.directory,
      strip: 0,
      filter: (path, entry) => {
        if (entry.path.endsWith('.mmdb')) {
          dbPath = entry.path;
          return true;
        }

        return false;
      },
    }).then(() => {
      if (!dbPath) {
        return res.send({ status: false, message: "No mmdb file found in tar" });
      }

      move(options.directory + '/' + dbPath, options.directory + '/GeoLite2-City.mmdb', function (err) {
        if (err) {
          winston.error("Error moving GeoIP database", err);
          return res.send({ status: false, message: 'Error copying' });
        }
        else {
          res.send({ status: true, message: "Database Updated" });
          //cleanup
          fs.remove(path);
          let folderName = dbPath.toString();
          folderName = folderName.substring(0, folderName.indexOf('/'));
          fs.remove(options.directory + '/' + folderName);
        }
      });
    })

    function move(oldPath, newPath, callback) {
      fs.rename(oldPath, newPath, function (err) {
        if (err) {
          if (err.code === 'EXDEV') {
            copy();
          } else {
            callback(err);
          }
          return;
        }
        callback();
      });

      function copy() {
        let readStream = fs.createReadStream(oldPath);
        let writeStream = fs.createWriteStream(newPath);

        readStream.on('error', callback);
        writeStream.on('error', callback);

        readStream.on('close', function () {
          fs.unlink(oldPath, callback);
        });

        readStream.pipe(writeStream);
      }
    }
  } catch (error) {
    winston.error("Error downloading geoip database, error: ", error);
    return res.send({ status: false, message: 'Error downloading' });
  }
}

exports.handleDatabaseStatus = function (req, res) {
  if (fs.existsSync('./public/files/geoip/GeoLite2-City.mmdb')) {
    res.send({ status: true, message: "Geoip is active" });
  }
  else {
    res.send({ status: false, message: "Geoip is not active because Database binary file not found" });
  }
}

function getDatabaseReader() {
  return new Promise(function (resolve, reject) {
    if (isServiceAvailable() == false) {
      resolve(null);
      return;
    }

    return Reader.open('./public/files/geoip/GeoLite2-City.mmdb')
      .then(function (reader) {
        resolve(reader);
      }).catch(function (err) {
        resolve(null);
      });
  });
}

exports.getDatabaseReader = getDatabaseReader;

function isServiceAvailable() {
  if (fs.existsSync('./public/files/geoip/GeoLite2-City.mmdb')) {
    return true;
  }
  return false;
}


exports.checkGeoIPTimezoneCache = (req, res, next) => {
  const ip = req.query.ip || '';

  redisClient.get(ip, (err, data) => {
    if (err) {
      res.status(500).send({ status: false, message: err });
    }

    if (data) {
      res.send(JSON.parse(data));
    } else {
      //proceed to next middleware function
      next();
    }
  });
};

exports.checkIPDataCache = (req, res, next) => {
  const ip = req.query.ip || '';

  redisClient.get(ip, (err, data) => {
    if (err) {
      res.status(500).send({ status: false, message: err });
    }

    if (data) {
      res.send(JSON.parse(data));
    } else {
      next();
    }
  });
};