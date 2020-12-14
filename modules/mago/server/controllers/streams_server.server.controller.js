"use strict";

/**
 * Module dependencies.
 */
const path = require("path"),
  errorHandler = require(path.resolve(
    "./modules/core/server/controllers/errors.server.controller"
  )),
  db = require(path.resolve("./config/lib/sequelize")).models,
  winston = require("winston"),
  DBModel = db.stream_server,
  Joi = require("joi");
const {
  getStreamServerLoad,
  updateServers,
} = require("../utils/getStreamServerLoad");

exports.create = function (req, res) {
  req.body.company_id = req.token.company_id; //save record for this company
  DBModel.create(req.body)
    .then(function (result) {
      if (!result) {
        return res.status(400).send({ message: "fail create data" });
      } else {
        return res.jsonp(result);
      }
    })
    .catch(function (err) {
      winston.error("Creating channel stream source failed with error: ", err);
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err),
      });
    });
};

exports.read = function (req, res) {
  if (req.streamServer.company_id === req.token.company_id)
    res.json(req.streamServer);
  else
    return res
      .status(404)
      .send({ message: "No data with that identifier has been found" });
};

exports.update = function (req, res) {
  const updateData = req.streamServer;
  const data = req.body;

  if (req.streamServer.company_id === req.token.company_id) {
    updateData
      .update(req.body)
      .then(async function (result) {
        await updateServers(data);
        res.json(result);
      })
      .catch(function (err) {
        winston.error(
          "Updating channel stream source failed with error: ",
          err
        );
        return res.status(400).send({
          message: errorHandler.getErrorMessage(err),
        });
      });
  } else {
    res
      .status(404)
      .send({ message: "User not authorized to access these data" });
  }
};

exports.delete = function (req, res) {
  const deleteData = req.streamServer;

  DBModel.findByPk(deleteData.id)
    .then(function (result) {
      if (result) {
        if (result && result.company_id === req.token.company_id) {
          // Delete the article
          result
            .destroy()
            .then(function () {
              return res.json(result);
            })
            .catch(function (err) {
              winston.error(
                "Deleting the channel stream source failed with error: ",
                err
              );
              return res.status(400).send({
                message: errorHandler.getErrorMessage(err),
              });
            });
        } else {
          return res.status(400).send({ message: "Unable to find the Data" });
        }
      } else {
        return res.status(400).send({
          message: "Unable to find the Data",
        });
      }
    })
    .catch(function (err) {
      winston.error(
        "Finding the channel stream source failed with error: ",
        err
      );
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err),
      });
    });
};

exports.list = function (req, res) {
  DBModel.findAndCountAll({
    where: { company_id: req.token.company_id },
  })
    .then(async function (results) {
      if (!results) {
        return res.status(404).send({
          message: "No data found",
        });
      } else {
        let arr = [];

        for (let i = 0; i < results.count; i++) {
          let data;
          const {
            connections,
            out_rate,
            connection_status = "Waiting",
            timestamp,
            status
          } = await getStreamServerLoad(results.rows[i].server_address);

          let obj = {
            ...results.rows[i].dataValues,
            connection: connections,
            out_rate,
            connection_status,
            last_update: timestamp,
          };
          arr.push(obj);
        }

        res.setHeader("X-Total-Count", results.count);
        res.json(arr);
      }
    })
    .catch(function (err) {
      winston.error(
        "Getting list of channel stream sources failed with error: ",
        err
      );
      res.jsonp(err);
    });
};

exports.dataByID = function (req, res, next) {
  const getID = Joi.number().integer().required();
  const { error, value } = getID.validate(req.params.streamServerId);

  if (error) {
    return res.status(400).send({
      message: "Data is invalid",
    });
  }

  DBModel.findOne({
    where: {
      id: value,
    },
  })
    .then(function (result) {
      if (!result) {
        return res.status(404).send({
          message: "No data with that identifier has been found",
        });
      } else {
        req.streamServer = result;
        next();
        return null;
      }
    })
    .catch(function (err) {
      winston.error("Finding channel stream source failed with error: ", err);
      return next(err);
    });
};
