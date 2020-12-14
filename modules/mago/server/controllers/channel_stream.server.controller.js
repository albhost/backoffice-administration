'use strict';

const cons = require('consolidate');

/**
 * Module dependencies.
 */
const path = require('path'),
  errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller')),
  db = require(path.resolve('./config/lib/sequelize')).models,
  winston = require('winston'),
  refresh = require(path.resolve('./modules/mago/server/controllers/common.controller.js')),
  DBModel = db.channel_stream,
  streamStore = require(path.resolve('./config/lib/stream_store')),
  escape = require(path.resolve('./custom_functions/escape')),
  sequelize = require(path.resolve('./config/lib/sequelize')).sequelize,
  Joi = require('joi'),
  vmx = require('../../../vmx/lib/vmx');

/**
 * Create
 */
exports.create = async function (req, res) {
  req.body.stream_resolution = req.body.stream_resolution.toString(); //convert array into comma-separated string
  req.body.company_id = req.token.company_id; //save record for this company

  if (req.body.drm_platform === 'verimatrix') {
    if (!req.body.vmx_content_id || !req.body.vmx_asset_id) {
      res.status(400).send({ message: 'For verimatrix drm platform both content id and asset id are required.' });
      return;
    }
  }

  let t = await sequelize.transaction();
    if (!req.body.encryption_url) {
        req.body.encryption = 0;
        req.body.encryption_url = 0;

    } else {
        req.body.encryption = 1;
    }



  try {
    let result = await DBModel.create(req.body, {transaction: t});

    if (req.body.drm_platform === 'verimatrix') {
      let vmxClient = vmx.getClient(req.token.company_id);
      
      let content = {
        id: req.body.vmx_content_id,
        title: req.body.vmx_content_id,
        contentType: 'DTV'
      }

      await vmxClient.upsertContent(content);
      
      let asset = {
        id: req.body.vmx_asset_id,
        networkType: "ITV",
        /*encryptionSettings: {
          ENCRYPTION_TYPE: "HTTP_STREAMING",
          ENCRYPTION_ALGORITHM: "AES_CBC",
          SECURITY_LEVEL: "0"
        }*/
      }

      let contentId = req.body.vmx_content_id;

      await vmxClient.upsertAsset(contentId, asset);

      await vmxClient.addPackageAsset('vmx-global-package', contentId, req.body.vmx_asset_id);
    }

    await streamStore.loadChannelStreamsToRedis(req.token.company_id, result.channel_id);

    await t.commit();

    res.json(result);
  }
  catch(err) {
    winston.error("Creating the channel stream failed with error: ", err);
    
    await t.rollback();

    return res.status(400).send({
      message: errorHandler.getErrorMessage(err)
    });
  }
};

/**
 * Show current
 */
exports.read = function (req, res) {
  if (req.channelStream.company_id === req.token.company_id) res.json(req.channelStream);
  else return res.status(404).send({ message: 'No data with that identifier has been found' });
};

/**
 * Update
 */
exports.update = async function (req, res) {
  req.body.stream_resolution = req.body.stream_resolution.toString(); //convert array into comma-separated string

  if (req.body.drm_platform === 'verimatrix') {
    if (!req.body.vmx_content_id || !req.body.vmx_asset_id) {
      res.status(400).send({ message: 'For verimatrix drm platform both content id and asset id are required.' });
      return;
    }
  }

  let t = await sequelize.transaction();

    if (!req.body.encryption_url || req.body.encryption_url === 0) {
        req.body.encryption = 0;
    } else {
        if((req.body.drm_platform === 'widevine') || (req.body.drm_platform === 'encryption')){
            req.body.encryption = 1;
        }
        else {
            req.body.encryption = 0;
            req.body.encryption_url = 0;
        }
    }
  try {
    let oldVmxData = {};

    if (req.channelStream.drm_platform === 'verimatrix') {
      console.log(req.channelStream.vmx_content_id && req.channelStream.vmx_content_id !== req.body.vmx_content_id);
      console.log(req.channelStream.vmx_asset_id && req.channelStream.vmx_asset_id !== req.body.vmx_asset_id);
      if (req.channelStream.vmx_content_id && req.channelStream.vmx_content_id !== req.body.vmx_content_id) {
        oldVmxData.contentId = req.channelStream.vmx_content_id;
      }

      if (req.channelStream.vmx_asset_id && req.channelStream.vmx_asset_id !== req.body.vmx_asset_id) {
        oldVmxData.assetId = req.channelStream.vmx_asset_id;
      }
    }

    let result = await req.channelStream.update(req.body, { transaction: t });

    let vmxClient = vmx.getClient(req.token.company_id);
    
    if (req.body.drm_platform === 'verimatrix') {
      if (oldVmxData.contentId) {
        let content = {
          id: req.body.vmx_content_id,
          title: req.body.vmx_content_id,
          contentType: 'DTV'
        }
  
        await vmxClient.upsertContent(content);
  
        await vmxClient.deleteAsset(req.channelStream.vmx_content_id, req.channelStream.vmx_asset_id);
        oldVmxData.assetId = req.channelStream.vmx_asset_id;
      }
  
      if (oldVmxData.assetId) {
        let asset = {
          id: req.body.vmx_asset_id,
          networkType: "ITV",
          /*encryptionSettings: {
            ENCRYPTION_TYPE: "HTTP_STREAMING",
            ENCRYPTION_ALGORITHM: "AES_CBC",
            SECURITY_LEVEL: "0"
          }*/
        }
  
        let contentId = !oldVmxData.contentId ? req.channelStream.vmx_content_id : req.body.vmx_content_id;
  
        await vmxClient.upsertAsset(contentId, asset);
  
        await vmxClient.addPackageAsset('vmx-global-package', contentId, req.body.vmx_asset_id);
      }
    }

    await streamStore.loadChannelStreamsToRedis(req.token.company_id, req.channelStream.channel_id)

    await t.commit();

    if (oldVmxData.contentId) {
      winston.error('Deleting old vmx content');
      try {
        await vmxClient.deleteContent(oldVmxData.contentId);
      }
      catch (err) {
        winston.error('Deleting old vmx data failed with error ', err)
      }
    }
    else if (oldVmxData.assetId) {
      winston.error('Deleting old vmx asset');
      try {
        await vmxClient.deleteAsset(req.channelStream.vmx_content_id, oldVmxData.assetId);
      } catch (err) {
        winston.error('Deleting old vmx data failed with error ', err)
      }
    }

    res.json(result);
  }
  catch (err) {
    winston.error("Updating the channel stream failed with error: ", err);

    if (t) {
      await t.rollback();
    }

    return res.status(400).send({
      message: errorHandler.getErrorMessage(err)
    });
  }
};

/**
 * Delete
 */
exports.delete = async function (req, res) {
  let t = await sequelize.transaction();
  try {
    await req.channelStream.destroy({transaction: t});

    if (req.channelStream.drm_platform === 'verimatrix') {
      let vmxClient = vmx.getClient(req.token.company_id);

      await vmxClient.deleteContent(req.channelStream.vmx_content_id);
    }

    await streamStore.loadChannelStreamsToRedis(req.token.company_id, req.channelStream.channel_id, true);

    await t.commit();

    res.json(req.channelStream);
  }
  catch(err) {
    winston.error("Deleting the channel stream failed with error: ", err);

    await t.rollback();

    return res.status(400).send({
      message: errorHandler.getErrorMessage(err)
    });
  }
};

/**
 * List
 */
exports.list = function (req, res) {

  var qwhere = {},
    final_where = {},
    query = req.query;

  //start building where
  final_where.where = qwhere;
  if (parseInt(query._start)) final_where.offset = parseInt(query._start);
  if (parseInt(query._end)) final_where.limit = parseInt(query._end) - parseInt(query._start);
  if(query._orderBy) final_where.order = [[escape.col(query._orderBy), escape.orderDir(query._orderDir)]];
  final_where.include = [db.channels, db.channel_stream_source];

  if (query.channel_id) qwhere.channel_id = query.channel_id;

  final_where.where.company_id = req.token.company_id; //return only records for this company

  DBModel.findAndCountAll(

    final_where

  ).then(function (results) {
    if (!results) {
      return res.status(404).send({
        message: 'No data found'
      });
    } else {

      res.setHeader("X-Total-Count", results.count);
      res.json(results.rows);
    }
  }).catch(function (err) {
    winston.error("Finding list of channel streams failed with error: ", err);
    res.jsonp(err);
  });
};

/**
 * middleware
 */
exports.dataByID = function (req, res, next) {
  const getID = Joi.number().integer().required();
  const {error, value} = getID.validate(req.params.channelStreamId);

  if (error) {
      return res.status(400).send({
          message: 'Data is invalid'
      });
  }

  DBModel.findOne({
    where: {
      id: value,
      company_id: req.token.company_id
    },
    include: [{
      model: db.channels
    },
    {
      model: db.channel_stream_source
    }]
  }).then(function (result) {
    if (!result) {
      return res.status(404).send({
        message: 'No data with that identifier has been found'
      });
    } else {
      req.channelStream = result;
      req.channelStream.stream_resolution = JSON.parse("[" + req.channelStream.stream_resolution + "]");
      next();
      return null;
    }
  }).catch(function (err) {
    winston.error("Finding the channel stream failed with error: ", err);
    return next(err);
  });

};
