'use strict'

const path = require('path'),
  db = require(path.resolve('./config/lib/sequelize')),
  models = db.models,
  response = require('../utils/response');
const winston = require('winston');
const nodemailer = require('nodemailer');
const Joi = require('joi');
const {Op} = require("sequelize")

/**
 * @api {get} /apiv4/customer-app/personal-settings Get personal settings
 * @apiVersion 4.0.0
 *
 * @apiName Get personal settings
 * @apiGroup CustomerApp
 *
 * @apiHeader {String} x-access-token Users JWT token.
 * @apiDescription Get personal settings of logged user
 *
 * @apiSuccessExample Success-Response:
 *  HTTP/1.1 200 OK
 *     {
 *       "data": {
 *          "id": "number",
 *          "customer_id": "number",
 *          "pin": "string",
 *          "show_adult": "boolean",
 *          "auto_timezone": "number",
 *          "timezone": "+1",
 *          "player": "string",
 *          "get_messages": "boolean"
 *        }
 *     }
 *
 * @apiErrorExample Error-Response:
 *  HTTP/1.1 500 Internal Server Error
 *   {
 *      "error": {
 *        "code": 51,
 *        "message": "Internal Error"
 *      }
 *   }
 *
 */
exports.getPersonalSettings = async (req, res) => {
  try {
    let result = await models.login_data.findOne({
      attributes: ['id', 'customer_id', 'pin', 'show_adult', 'auto_timezone', 'timezone', 'player', 'get_messages'],
      where: {username: req.auth.data.username, company_id: req.auth.company_id}
    })

    if (!result) {
      winston.error("User not found via token.");
      return response.sendError(req, res, 404, 2);
    }
    result.timezone = result.timezone < 1 ? result.timezone : "+" + result.timezone;
    response.sendData(req, res, result);
  } catch (error) {
    winston.error("Finding user via token failed with error: ", error);
    response.sendError(req, res, 500, 51);
  }
};


/**
 * @api {get} /apiv4/customer-app/user-data Get user data
 * @apiVersion 4.0.0
 *
 * @apiName Get personal data
 * @apiGroup CustomerApp
 *
 * @apiHeader {String} x-access-token Users JWT token.
 * @apiDescription Get personal information of logged user
 *
 * @apiSuccessExample Success-Response:
 *   HTTP/1.1 200 OK
 *     {
 *       "data": {
 *          "firstname": "string",
 *          "lastname": "string",
 *          "email": "string",
 *          "address": "string",
 *          "city": "string",
 *          "country": "string",
 *          "telephone": "string"
 *       }
 *     }
 *
 * @apiErrorExample Error-Response:
 *  HTTP/1.1 404 Not Found
 *   {
 *      "error": {
 *          "code": 2,
 *          "message": "User not found"
 *      }
 *   }
 *
 * @apiErrorExample Error-Response:
 *  HTTP/1.1 500 Internal Server Error
 *   {
 *      "error": {
 *        "code": 51,
 *        "message": "Internal Error"
 *      }
 *   }
 *
 */
exports.getUserData = async (req, res) => {
  try {
    let login_data = await models.login_data.findOne({
      attributes: ['customer_id', 'username'],
      where: {username: req.auth.data.username, company_id: req.auth.data.company_id}
    })
    let customer_data = await models.customer_data.findOne({
      attributes: ['firstname', 'lastname', 'email', 'address', 'city', 'country', 'telephone'],
      where: {id: login_data.customer_id}
    })
    response.sendData(req, res, {...customer_data.dataValues, username: login_data.dataValues.username});
  } catch (error) {
    winston.error("Getting the customer's personal data failed with error: ", error);
    response.sendError(req, res, 500, 51);
  }
};


/**
 * @api {put} /apiv4/customer-app/update-user-settings Update user settings
 * @apiVersion  4.0.0
 *
 * @apiName User Settings
 * @apiGroup CustomerApp
 *
 * @apiHeader {String} x-access-token Users JWT token.
 * @apiSuccess (Success 200) {Object} response Response
 * @apiParam {Number} [pin] Pin code
 * @apiParam {Number} [timezone] Timezone of client
 * @apiParam {Number} [auto_timezone] Auto timezone
 * @apiParam {Bool} [show_adult] Show adult content
 * @apiParam {String} [player] Player
 * @apiParam {Bool} [get_messages] Get push notification
 *
 * @apiErrorExample Error-Response:
 *  HTTP/1.1 400 Bad Request
 *   {
 *      "error": {
 *         "code": 36,
 *         "message": "Bad Request"
 *      }
 *   }
 *
 *  @apiErrorExample Error-Response:
 *  HTTP/1.1 500 Internal Server Error
 *   {
 *      "error": {
 *        "code": 51,
 *        "message": "Internal Error"
 *      }
 *   }
 */
exports.updateUserSettings = async (req, res) => {
  try {
    let updateFields = {};
    if (req.body.player) {
      updateFields.player = req.body.player;
      updateFields.livetvlastchange = (req.user.player.toUpperCase() !== req.body.player.toUpperCase()) ? Date.now() : req.user.livetvlastchange //if player changes, livetv data should be updated
    }
    Object.assign(updateFields, {
      pin: req.body.pin,
      timezone: req.body.timezone,
      auto_timezone: req.body.auto_timezone,
      show_adult: req.body.show_adult,
      get_messages: req.body.get_messages,
    });

    const removeNullAndUndefined = removeNullUndefinedFromObject(updateFields)

    const schema = Joi.object().keys({
      pin: Joi.number().integer(),
      timezone: Joi.number(),
      auto_timezone: Joi.number(),
      show_adult: Joi.boolean(),
      player: Joi.string(),
      get_messages: Joi.boolean(),
      livetvlastchange: Joi.number()
    });
    const {error, value} = schema.validate(removeNullAndUndefined);
    if (error) {
      winston.error("Data are not correct: ", error.message);
      return response.sendError(req, res, 400, 36);
    }

    await models.login_data.update(value, {where: {username: req.auth.data.username}})
    response.sendData(req, res);
  } catch (error) {
    winston.error("Updating the client's account information failed with error: ", error);
    response.sendError(req, res, 500, 51);
  }
};

/**
 * @param {Object} object The object to be cleaned
 * @returns returns object without null and undefined values
 */
function removeNullUndefinedFromObject(object) {
  Object.keys(object).forEach(key => {
    if (object[key] === null || object[key] === undefined) {
      delete object[key];
    }
  });
  return object;
}


/**
 * @api {put} /apiv4/customer-app/update-user-data Update user data
 * @apiName Update User Data
 * @apiGroup CustomerApp
 * @apiVersion  4.0.0
 * @apiHeader {String} x-access-token token Authorization key
 * @apiSuccess (Success 200) {Object} Request
 * @apiParam {String} [firstname] First name
 * @apiParam {String} [lastname] Last name
 * @apiParam {String} [email] Email
 * @apiParam {String} [address] Address
 * @apiParam {String} [city] City
 * @apiParam {String} [country] Country
 * @apiParam {String} [telephone] Telephone
 *
 *  @apiErrorExample Error-Response:
 *  HTTP/1.1 400 Bad Request
 *   {
 *      "error": {
 *         "code": 36,
 *         "message": "Bad Request"
 *      }
 *   }
 *
 *  @apiErrorExample Error-Response:
 *  HTTP/1.1 500 Internal Server Error
 *   {
 *      "error": {
 *        "code": 51,
 *        "message": "Internal Error"
 *      }
 *   }
 *
 */
exports.updateUserData = async (req, res) => {
  try {
    let customerData = await findCustomerData(req.user.customer_id);
    if (!customerData) {
      return response.sendError(req, res, 404, 59)
    }
    let updatedCustomer = await updateCustomerData(customerData, req.body);
    await findEmailTemplate(req, updatedCustomer, customerData);

    response.sendData(req, res, 200);
  } catch (error) {
    if (error.code === 36) {
      return response.sendError(req, res, 400, 36)
    }
    if (error.code === 12) {
      return response.sendError(req, res, 400, 12)
    }
    winston.error("Process of updating user data has failed: ", error);
    response.sendError(req, res, 500, 51);
  }
};


async function findCustomerData(customerId) {
  try {
    let customerData = await models.customer_data.findOne({
      attributes: ['id', 'firstname', 'lastname', 'email'],
      where: {id: customerId}
    })
    return Promise.resolve(customerData);
  } catch (error) {
    winston.error("Finding the customer's personal information failed with error: ", error);
    return Promise.reject(error)
  }
}

async function updateCustomerData(customerData, requestBody) {
  try {
    let updateFields = {
      firstname: requestBody.firstname,
      lastname: requestBody.lastname,
      email: requestBody.email,
      address: requestBody.address,
      city: requestBody.city,
      country: requestBody.country,
      telephone: requestBody.telephone
    };
    const removeNullAndUndefined = removeNullUndefinedFromObject(updateFields)

    const schema = Joi.object().keys({
      firstname: Joi.string().trim(),
      lastname: Joi.string().trim(),
      email: Joi.string().trim().email(),
      address: Joi.string(),
      city: Joi.string(),
      country: Joi.string(),
      telephone: Joi.string()
    });
    const {error, value} = schema.validate(removeNullAndUndefined);
    if (error) {
      winston.error("Customer data are not valid for update!");
      return Promise.reject({code: 36})
    }
    // check for duplicate email
    const customerExists = await models.customer_data.findOne({
      attributes: ['email'],
      where: {email: value.email}
    })
    if (customerExists && customerExists.email !== customerData.email) {
      winston.error("Email already exist to another customer!");
      return Promise.reject({code: 12});
    }
    let isUpdated = await models.customer_data.update(value, {
      where: {id: customerData.id}
    })
    return Promise.resolve(isUpdated[0]);
  } catch (error) {
    winston.error("Updating the customer's personal information failed with error: ", error);
    return Promise.reject(error)
  }
}


// check email_templates
async function findEmailTemplate(req, isUpdated, customer_data) {
  try {
    let emailTemplate = await models.email_templates.findOne({
      attributes: ['title', 'content'],
      where: {template_id: 'new-email', company_id: req.user.company_id}
    })

    let email_body = '';
    if (!emailTemplate) {
      email_body = 'Dear ' + customer_data.firstname + ' ' + customer_data.lastname + ', the email address associated to your Magoware account has been changed to ' + req.body.email;
    } else {
      const contentFromUI = emailTemplate.content;
      email_body = contentFromUI.replace(new RegExp('{{customer_data.firstname}}', 'gi'), customer_data.firstname).replace(new RegExp('{{customer_data.lastname}}', 'gi'), customer_data.lastname).replace(new RegExp('{{req.body.email}}', 'gi'), req.body.email);
    }

    if (isUpdated && customer_data.email !== req.body.email) {
      const smtpConfig = {
        host: (req.app.locals.backendsettings[req.user.company_id].smtp_host) ? req.app.locals.backendsettings[req.user.company_id].smtp_host.split(':')[0] : 'smtp.gmail.com',
        port: (req.app.locals.backendsettings[req.user.company_id].smtp_host) ? Number(req.app.locals.backendsettings[req.user.company_id].smtp_host.split(':')[1]) : 465,
        secure: (req.app.locals.backendsettings[req.user.company_id].smtp_secure === false) ? req.app.locals.backendsettings[req.user.company_id].smtp_secure : true,
        auth: {
          user: req.app.locals.backendsettings[req.user.company_id].email_username,
          pass: req.app.locals.backendsettings[req.user.company_id].email_password
        }
      };
      const smtpTransport = nodemailer.createTransport(smtpConfig);
      const mailOptions = {
        from: req.app.locals.backendsettings[req.user.company_id].email_address,
        to: customer_data.email,
        subject: 'Email changed', // Subject line
        html: '<b>' + email_body + '</b>' // html body
      };
      smtpTransport.sendMail(mailOptions, (error, info) => {
        if (error) {
          winston.error("Error sending email at customers_app: ", error);
          return Promise.reject(error);
        }
        return Promise.resolve();
      });
    }
    return Promise.resolve();
  } catch (error) {
    return Promise.reject(error);
  }
}


/**
 * @api {GET} /apiv4/customer-app/purchases Get Purchases
 * @apiName Update User Data
 * @apiGroup CustomerApp
 * @apiVersion  4.0.0
 * @apiHeader {String} x-access-token token Authorization key
 * @apiSuccess (Success 200) {Object} Request

 *  @apiErrorExample Error-Response:
 *  HTTP/1.1 400 Bad Request
 *   {
 *      "error": {
 *         "code": 36,
 *         "message": "Bad Request"
 *      }
 *   }
 *
 *  @apiErrorExample Error-Response:
 *  HTTP/1.1 500 Internal Server Error
 *   {
 *      "error": {
 *        "code": 51,
 *        "message": "Internal Error"
 *      }
 *   }
 *
 */
exports.getPurchases = async (req, res) => {
  try {
    const salesResult = await models.salesreport.findAll({
      attributes: ['user_username', ['distributorname', 'distributor_name'], 'saledate'],
      where: {login_data_id: req.user.id},
      include: [
        {model: models.combo, required: true, attributes: ['duration', 'name']},
        {model: models.users, required: true, attributes: ['username']}
      ]
    })

    const sales = salesResult.map(sales => ({
      user_username: req.auth.data.username,
      distributor_name: sales.user.username,
      sale_date: sales.saledate,
      combo_name: sales.combo.name,
      combo_duration: sales.combo.duration
    }))

    response.sendData(req, res, sales);
  } catch (error) {
    winston.error("Cannot get subscription at v4, error: ", error);
    response.sendError(req, res, 500, 51);
  }
};


/**
 * @api {put} /apiv4/customer-app/subscription Get User Subscription
 * @apiName Update User Data
 * @apiGroup CustomerApp
 * @apiVersion  4.0.0
 * @apiHeader {String} x-access-token token Authorization key
 * @apiSuccess (Success 200) {Object} Request
 *
 *  @apiErrorExample Error-Response:
 *  HTTP/1.1 400 Bad Request
 *   {
 *      "error": {
 *         "code": 36,
 *         "message": "Bad Request"
 *      }
 *   }
 *
 *  @apiErrorExample Error-Response:
 *  HTTP/1.1 500 Internal Server Error
 *   {
 *      "error": {
 *        "code": 51,
 *        "message": "Internal Error"
 *      }
 *   }
 *
 */
exports.getSubscription = async (req, res) => {
  try {
    const subscriptionResult = await models.subscription.findAll({
      attributes: ['id', 'start_date', 'end_date'],
      where: {customer_username: req.auth.data.username, end_date: {[Op.gte]: Date.now()}},
      include: [{model: models.package, required: true, attributes: ['package_name']}]
    });

    const subscription = subscriptionResult.map(sub => ({
      package_name: sub.package.package_name,
      start_date: sub.start_date,
      end_date: sub.end_date
    }))
    response.sendData(req, res, subscription);
  } catch (error) {
    winston.error("Cannot get subscription at v4, error: ", error);
    response.sendError(req, res, 500, 51);
  }
};