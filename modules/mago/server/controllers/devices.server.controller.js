'use strict';

/**
 * Module dependencies.
 */
const path = require('path'),
  errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller')),
  winston = require('winston'),
  db = require(path.resolve('./config/lib/sequelize')),
  models = db.models,
  geoip = require(path.resolve('./modules/geoip/server/controllers/geoip_logic.server.controller.js')),
  vmx = require('../../../vmx/lib/vmx'),
  sequelize = require(path.resolve('./config/lib/sequelize')).sequelize,
  response = require(path.resolve('./config/responses'));
const Joi = require("joi");
const { Op } = require('sequelize');
const escape = require(path.resolve('./custom_functions/escape'));

/**
 * Create
 */
exports.create = function (req, res) {
  req.body.company_id = req.token.company_id; //save record for this company

  models.devices.create(req.body).then(function (result) {
    if (!result) {
      return res.status(400).send({message: 'fail create data'});
    } else {
      return res.jsonp(result);
    }
  }).catch(function (err) {
    winston.error("Adding device failed with error: ", err);
    return res.status(400).send({
      message: errorHandler.getErrorMessage(err)
    });
  });
};

/**
 * Show current
 */
exports.read = function (req, res) {
  res.json(req.device);
};

/**
 * Update
 */
exports.update = async (req, res) => {
  try {
    const t = await sequelize.transaction();
    try {
      const findDevice = await models.devices.findOne({
        include: [{
          model: models.device_mediaplayer,
          include: [{
            model: models.media_player
          }]
        }],
        where: {
          id: req.params.deviceId,
          company_id: req.token.company_id
        }
      });
      if (!findDevice) {
        return res.status(404).send({ message: 'No data with that identifier has been found!' });
      }
      await findDevice.update(req.body, { transaction: t })
      // commented when media player is not implemented yet on UI
      /* await models.device_mediaplayer.update({
        mediaplayer_id: req.body.device_mediaplayer.media_player.id
      }, {
        where: { device_id: findDevice.id },
        transaction: t
      }); */
      await t.commit();
      res.json(findDevice);
    } catch (error) {
      winston.error("Updating device failed with error: ", error);
      await t.rollback();
      res.status(500).send({ message: errorHandler.getErrorMessage(error) });
    }
  } catch (err) {
    winston.error("Error initiation transaction: ", err);
    res.status(500).send({ message: errorHandler.getErrorMessage(err) });
  }
};

/**
 * Delete
 */
exports.delete = async function (req, res) {
  try {
    if (req.device.vmx_id) {
      let vmxClient = vmx.getClient(req.token.company_id);
      await vmxClient.deleteDevice(req.device.vmx_id);
    }

    await req.device.destroy();

    res.json(req.device);
  } 
  catch(err) {
    winston.error('Failed to delete device to vmx');
    return res.status(400).send({
      message: errorHandler.getErrorMessage(err)
    });
  }
};

exports.deleteOld = async function(req, res) {
 if (!req.query.older_than_years) {
    res.status(400).send({message: 'The Older than field was empty'});
    return;
  }

  let olderThanYears = parseInt(req.query.older_than_years);

      let date = new Date();
      date.setFullYear(date.getFullYear() - olderThanYears, date.getMonth(), date.getDate());

      try {
        await models.devices.destroy({
          where: {
            company_id: req.token.company_id,
            updatedAt: {
              [Op.lte]: date
            }
          }
        });

        res.json({message: 'Old devices were deleted successfully'})
      }
      catch(err) {
        winston.error('Failed to delete old devices');
        return res.status(400).send({
          message: errorHandler.getErrorMessage(err)
        });
      }
}

/**
 * List
 */
exports.list = function (req, res) {

  var qwhere = {},
    final_where = {},
    query = req.query;

  const company_id = req.token.company_id || 1;

  if (query.q) {
    let filters = []
    filters.push(
      { username: { [Op.like]: `%${query.q}%` } },
      { device_id: { [Op.like]: `%${query.q}%` } },
      { device_ip: { [Op.like]: `%${query.q}%` } },
      { device_brand: { [Op.like]: `%${query.q}%` } },
      { device_mac_address: { [Op.like]: `%${query.q}%` } },
      { os: { [Op.like]: `%${query.q}%` } },
    );
    qwhere = { [Op.or]: filters };
  }

  final_where.where = qwhere;
  if (parseInt(query._start)) final_where.offset = parseInt(query._start);
  if (parseInt(query._end)) final_where.limit = parseInt(query._end) - parseInt(query._start);
  if(query._orderBy) final_where.order = [[escape.col(query._orderBy), escape.orderDir(query._orderDir)]];

  final_where.include = [{
    model: models.device_mediaplayer,
    include: [{
      model: models.media_player
    }]
  }];

  if (query.login_data_id) qwhere.login_data_id = query.login_data_id;
  if (query.appid) qwhere.appid = query.appid;
  if (query.app_version) qwhere.app_version = query.app_version;
  if (query.ntype) qwhere.ntype = query.ntype;
  if (query.device_active === 'true') qwhere.device_active = true;
  else if (query.device_active === 'false') qwhere.device_active = false;
  if (query.hdmi) qwhere.hdmi = query.hdmi;
  if (query.username) qwhere.username = query.username;

  final_where.where.company_id = company_id; //return only records for this company

  models.devices.findAndCountAll(
    final_where
  ).then(function (results) {
    if (!results) {
      res.status(404).send({
        message: 'No data found'
      });
      return null;
    } else {
      res.setHeader("X-Total-Count", results.count);

      geoip.getDatabaseReader()
        .then(function (reader) {
          for (let i = 0; i < results.rows.length; i++) {
            let city;
            if (reader) {
              try {
                city = reader.city(results.rows[i].device_ip).city;
              } catch (e) {
                city = {names: {en: ""}}
              }
            }
            else {
              city = {names: {en: "Service unavailable"}}
            }
            results.rows[i].dataValues.city = city.names ? city.names.en : "";
          }
          res.json(results.rows)
        });
    }
  }).catch(function (err) {
    winston.error("Getting device list failed with error: ", err);
    return res.jsonp(err);
  });
};


/**
 * Remove
 */
exports.deleteByYear = function(req, res) {

    var result = [1, 2, 3];
    response.send_res(req, res, result, 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'private,max-age=7200');

};

/**
 * middleware
 */
exports.dataByID = function (req, res, next) {
  let id = req.params.deviceId;
  if ((id % 1 === 0) === false) { //check if it's integer
    return res.status(400).send({ message: 'Data is invalid' });
  }

  models.devices.findOne({
    include: [{
      model: models.device_mediaplayer,
      include: [{
        model: models.media_player
      }]
    }],
    where: {
      id: id,
      company_id: req.token.company_id
    },
  }).then(function (result) {
    if (!result) {
      return res.status(404).send({ message: 'No data with that identifier has been found' });
    }
    req.device = result;
    next();
  }).catch(function (err) {
    winston.error("Getting device data failed with error: ", err);
    return res.status(500).send({ message: errorHandler.getErrorMessage(err) });
  });
};


