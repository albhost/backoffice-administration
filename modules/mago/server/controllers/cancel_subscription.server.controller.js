'use strict';

/**
 * Module dependencies.
 */
var path = require('path'),
    errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller')),
    winston = require('winston'),
    db = require(path.resolve('./config/lib/sequelize')).models,
    DBModel = db.salesreport,
    subscription_functions = require(path.resolve('./custom_functions/sales.js'));


/**
 * Update
 */
exports.update = function (req, res) {
  var sale_or_refund = -1;
  var transaction_id = req.body.transaction_id;

  db.salesreport.findOne({ where: { transaction_id: transaction_id } })
    .then(function (transaction) {
      if (!transaction) {
        res.status(404).send({ error: { code: 404, message: 'Transaction not found' } })
      } else {
        req.body.combo_id = transaction.combo_id;
        db.login_data.findOne({ where: { id: transaction.login_data_id } })
          .then(function (user) {
            if (user) {
              req.body.username = user.username;
              subscription_functions.add_subscription_transaction(req, res, -2, req.body.transaction_id).then(function (result) {
                if (result.status) {
                  var updateData = req.salesReport;
                  req.body.cancelation_date = Date.now();
                  req.body.cancelation_user = req.token.id;
                  req.body.company_id = req.token.company_id; //save record for this company
                  updateData.update(req.body).then(function (result) {
                    res.send({ data: { message: 'Subscription Canceled' } });
                    return null;
                  }).catch(function (err) {
                    winston.error("Updating sale failed with error: ", err);
                    return res.status(400).send({ message: errorHandler.getErrorMessage(err) });
                  });
                } else {
                  res.status(404).send(result)
                }
              });
            }
          });
      }
    })
};