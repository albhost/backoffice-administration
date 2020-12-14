'use strict';
const path = require('path'),
  db = require(path.resolve('./config/lib/sequelize')),
  response = require(path.resolve("./config/responses.js")),
  password_encryption = require(path.resolve('./modules/deviceapiv2/server/controllers/authentication.server.controller.js')),
  authentication = require(path.resolve('./modules/deviceapiv2/server/controllers/authentication.server.controller.js')),
  models = db.models,
  async = require("async"),
  config = require(path.resolve('./config/config')),
  mail = require(path.resolve("custom_functions/mail.js")),
  winston = require("winston");

const crypto = require("crypto");
const Joi = require("joi");
const { Op } = require('sequelize');
const responseHandler = require("../utils/response");
const getClientIP = require(path.resolve('./custom_functions/getClientIP'));
const moment = require("moment");
const push_msg = require("../../../../custom_functions/push_messages");

/**
 *
 * @apiDescription Logins a user, if the same users exists on multiple companies then show company list, if it only exists on one then login that user directly.
 *
 * @apiParam {String} username Customers login username.
 * @apiParam {String} password Customers login password.
 * @apiParam {String} screen_size eg. "1920x1080"
 * @apiParam {Integer} app_id The platform id.
 * @apiParam {String} device_brand
 * @apiParam {Integer} [ntype] Network type
 * @apiParam {String} app_name
 * @apiParam {String} os Operating System
 * @apiParam {String} [api_version] Api Version
 * @apiParam {String} app_version
 * @apiParam {Integer} device_timezone Device timezone, 2, -1, 2 etc...
 * @apiParam {Boolean} [hdmi]
 * @apiParam {String} firmware_version
 * @apiParam {String} [language]
 * @apiParam {String} device_id Unique device ID.
 * @apiParam {String} timestamp
 * @apiParam {String} [mac_address]
 */
exports.company_list = function (req, res, next) {

  models.login_data.findAll({
    attributes: ['id', 'username', 'password', 'salt', 'company_id'],
    where: {username: req.auth.username},
    include: [{model: models.settings, attributes: ['id', 'company_name', 'new_encryption_key'], required: true}]
  }).then(function (companies) {
    if (!companies) {
      return responseHandler.sendError(req, res, 401, 58)
    } else {
      let company_list = [];
      for (let i = 0; i < companies.length; i++) {
        if (password_encryption.encryptPassword(req.body.password, companies[i].salt) === companies[i].password) {
          company_list.push(companies[i].setting);
        }
      }

      //if no password match
      if (company_list.length === 0) {
        return responseHandler.sendError(req, res, 401, 58)
      }
      //if one password match
      else if (company_list.length === 1 && companies[0].setting.id === 1) {
        req.auth.company_id = companies[0].setting.id;
        req.body.company_id = companies[0].setting.id;
        req.body.isFromCompanyList = true;
        req.url = '/apiv4/auth/login';
        return req.app._router.handle(req, res, next);
      } else {
        responseHandler.sendData(req, res, company_list)
      }
    }

  }).catch(function (error) {
    winston.error("Finding the list of companies for this user failed with error: ", error);
    return responseHandler.sendError(req, res, 401, 51)
  });
};

//improved function to controll login on multiple devices per screen size.
/**
 * @api {post} /apiv4/credentials/login Login v4
 * @apiVersion 4.0.0
 * @apiName DeviceLoginv4
 * @apiGroup DeviceAPI
 *
 * @apiDescription User login with their credentials and device information
 *
 * @apiParam {String} username Customers login username.
 * @apiParam {String} password Customers login password.
 * @apiParam {String} screen_size eg. "1920x1080"
 * @apiParam {Integer} app_id The platform id.
 * @apiParam {String} device_brand Brand of the device
 * @apiParam {Integer} [ntype] Network type
 * @apiParam {String} app_name Application name
 * @apiParam {String} os Operating System
 * @apiParam {String} [api_version] Api Version
 * @apiParam {String} app_version Version of the app
 * @apiParam {Integer} device_timezone Device timezone, 2, -1, 2 etc...
 * @apiParam {Boolean} [hdmi] HDMI
 * @apiParam {String} firmware_version Firmware version
 * @apiParam {String} [language] Language for the app
 * @apiParam {String} device_id Unique device ID.
 * @apiParam {String} timestamp UTC timestamp
 * @apiParam {String} mac_address MAC address of the device
 */
exports.login = function (req, res) {
  models.app_group.findOne({
    attributes: ['app_group_id'],
    where: {app_id: req.auth.app_id}
  }).then(function (app_group) {
    models.devices.findAll({
      include: [{
        model: models.app_group,
        required: true,
        attributes: [],
        where: {app_group_id: app_group.app_group_id}
      }],
      where: {username: req.auth.username, device_active: true, device_id: {[Op.not]: req.auth.device_id}}
    }).then(function (device) {

      if (!device || device.length < Number(req.user.max_login_limit)) {
        upsertDevice({
          device_active: true,
          login_data_id: req.user.id,
          username: req.auth.username,
          device_mac_address: decodeURIComponent(req.body.mac_address),
          appid: req.auth.app_id,
          app_name: (req.body.app_name) ? req.body.app_name : '',
          app_version: req.body.app_version ? req.body.app_version : "1.0.0",
          ntype: req.body.ntype ? req.body.ntype : 1,
          device_id: req.auth.device_id,
          hdmi: (req.body.hdmi == 'true') ? 1 : 0,
          firmware: decodeURIComponent(req.body.firmware_version),
          device_brand: decodeURIComponent(req.body.device_brand),
          screen_resolution: decodeURIComponent(req.body.screen_size),
          api_version: decodeURIComponent(req.body.api_version),
          device_ip: getClientIP(req),
          os: decodeURIComponent(req.body.os),
          language: req.body.language,
          company_id: req.user.company_id,
        }).then(function (result) {
          const response = {
            access_token: req.deviceToken,
            refresh_token: req.refreshToken,
            company_id: req.user.company_id
          }
          return responseHandler.sendData(req, res, response)
        }).catch(function (error) {
          winston.error("device upsert error : ", error);
          responseHandler.sendError(req, res, 401, 51)
        });
      } else {
        responseHandler.sendError(req, res, 406, 5)
      }
      return null;
    }).catch(function (error) {
      winston.error("database error device search : ", error);
      responseHandler.sendError(req, res, 401, 51)
    });
    return null;
  }).catch(function (error) {
    winston.error("Searching for the app group's data failed with error: ", error);
    responseHandler.sendError(req, res, 401, 51)
  });

};

function upsertDevice(device) {
  return new Promise(function (resolve, reject) {
    models.devices.findOne({
      where: {device_id: device.device_id}
    }).then(function (result) {
      if (!result) {
        return models.devices.create(device)
          .then(function () {
            resolve();
          })
          .catch(function (err) {
            reject(err);
          });
      } else {
        return result.update(device)
          .then(function () {
            resolve();
          })
          .catch(function (err) {
            reject(err);
          });
      }
    }).catch(function (err) {
      reject(err);
    });
  });
}

/**
 * @api {post} /apiv4/auth/logout Logout v4
 * @apiVersion 4.0.0
 * @apiName DeviceLogout
 * @apiGroup DeviceAPI
 *
 * @apiHeader {String} x-access-token Users JWT token.
 * @apiDescription Logs out the user from device so user can login on another device
 * @apiSuccess (Success 200) {Object} response Response
 *
 * @apiErrorExample Error-Response:
 *  HTTP/1.1 500 Internal Server Error
 *   {
 *      "error": {
 *        "code": 51,
 *        "message": "Internal Error"
 *      }
 *   }
 */
exports.logout = function (req, res) {
  models.devices.update({device_active: false}, {
    where: {username: req.auth.data.username, appid: req.auth.data.app_id, company_id: req.user.company_id}
  }).then(() => {
    responseHandler.sendData(req, res, 200);
  }).catch(error => {
    winston.error("Setting device inactive failed with error: ", error);
    responseHandler.sendError(req, res, 500, 51);
  });
};
/**
 * @api {post} /apiv4/auth/logout/all Logout v4
 * @apiVersion 4.0.0
 * @apiName DeviceLogout
 * @apiGroup DeviceAPI
 *
 * @apiHeader {String} x-plain-access-token (username, password, app_id, company_id, mac_adress stringified in json, and then encoded)
 * @apiDescription Logs out the user from device so user can login on another device
 * @apiSuccess (Success 200) {Object} response Response
 *
 * @apiErrorExample Error-Response:
 *  HTTP/1.1 500 Internal Server Error
 *   {
 *      "error": {
 *        "code": 51,
 *        "message": "Internal Error"
 *      }
 *   }
 */
exports.logoutAllDevices = async function (req, res) {
  const company_id = req.user.company_id;
  try {

    const settings = req.app.locals.backendsettings[company_id];

    const device = await models.devices.findOne({
      where: {
        device_active: true,
        login_data_id: req.user.id
      },
      order: [['updatedAt', 'ASC']]
    });

    if(!device) return responseHandler.sendError(req, res, 404, 34);

    device.device_active = false;
    await device.save();

    if(device.googleappid) {
      const message = new push_msg.ACTION_PUSH('Action', "You have been logged in another device", '5', "logout_user");
      push_msg.send_notification(device.googleappid, settings.firebase_key, '', message, 5, false, true, null);
    }

    return responseHandler.sendData(req, res, { success: true });
  } catch (e) {
    winston.error("There was a error at logging out from all devices, error: ", e);
    responseHandler.sendError(req, res, 500, 51);
  }
};

/**
 * @api {post} /apiv4/auth/password/forgot Logout v4
 * @apiVersion 4.0.0
 * @apiName ForgotPassword
 * @apiParam {String} username Customer username.
 * @apiGroup DeviceAPI
 *
 * @apiHeader {String} x-access-token Users JWT token.
 * @apiDescription Endpoint to reset your password.
 * @apiSuccess (Success 200) {Object} response Response
 *
 * @apiErrorExample Error-Response:
 *  HTTP/1.1 500 Internal Server Error
 *   {
 *      "error": {
 *        "code": 51,
 *        "message": "Internal Error"
 *      }
 *   }
 */
exports.forgotPassword = async function (req, res) {
  const companyId = 1;

  const schema = Joi.object().keys({
    username: Joi.string().alphanum().required()
  });

  const {error, value} = schema.validate(req.body);

  if (error) return responseHandler.sendError(req, res, 400, 60)

  const username = value.username;
  try {
    const resetPasswordToken = crypto.randomBytes(Math.ceil(64)).toString('hex').slice(0, 25);

    const user = await models.login_data.findOne({
      where: {
        username: username,
        company_id: companyId
      },
      include: [{model: models.customer_data}]
    });

    if (!user) return responseHandler.sendError(req, res, 500, 2)

    const updatedUser = await user.update({
      resetPasswordToken: resetPasswordToken,
      resetPasswordExpires: moment().add('2', 'hours').toISOString()
    })

    if (!updatedUser) return responseHandler.sendError(req, res, 500, 64);

    const emailTemplates = await models.email_templates.findOne({
      attributes: ['title', 'content'],
      where: {template_id: 'reset-password-email-device', company_id: companyId}
    });

    const link = req.protocol + '://' + req.get('host') + '/apiv4/auth/password/reset/' + resetPasswordToken;
    let emailHTML = '';

    if (!emailTemplates)
      emailHTML = "Dear user, please click this link to go to reset your password: " + link;
    else {
      const response = emailTemplates.content;
      emailHTML = response
        .replace(new RegExp('{{name}}', 'gi'), user.customer_datum.firstname + ' ' + user.customer_datum.lastname)
        .replace(new RegExp('{{username}}', 'gi'), username)
        .replace(new RegExp('{{appName}}', 'gi'), config.app.title)
        .replace(new RegExp('{{link}}', 'gi'), link);
    }

    const mailOptions = {
      to: user.customer_datum.email,
      content_type: 'html',
      body: emailHTML,
      subject: 'Password Reset',
      company_id: user.company_id
    };

    const sent = await mail.send(req, mailOptions);

    return responseHandler.sendData(req, res, sent);
  } catch (e) {
    winston.error("There was a error at forgot password, error: ", e);
    responseHandler.sendError(req, res, 500, 63);
  }
}

exports.renderPasswordForm = async function (req, res) {
  try {
    const token = req.params.token;
    if (!token) throw new Error("Token not valid");

    const user = await models.login_data.findOne({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: {
          [Op.gt]: new Date().toISOString()
        }
      }
    });

    if (!user) throw new Error("User not found");

    res.render(path.resolve('modules/device-api-v4/server/templates/reset-password'), {token}, function (err, html) {
      res.send(html);
    });
  } catch (e) {
    return res.send('<html><body style="background-color:">' +
      '<div style="font-size:20px;padding: 35px;border-radius:6px;color: #ffffff;background-color: #fc5c5a;border-color: #ffffff;">' +
      '<center><span>Error: </span>Link is not valid</center></div></body></html>');
  }
}

exports.resetForgottenPassword = async function (req, res) {
  const token = req.params.token;

  const schema = Joi.object().keys({
    password: Joi.string().required(),
    repeat_password: Joi.string().required()
  })

  const {error, value} = schema.validate(req.body);

  if (error || !token) {
    return res.status(400).json({message: "Bad passwords or token!"})
  }

  const {password: newPass, repeat_password: confirmPassword} = value

  if (newPass !== confirmPassword) {
    return res.status(401).json({message: "Passwords dont match"})
  }

  if (newPass.length < 4) {
    return res.status(400).json({message: "Password must be longer than 4 characters"})
  }

  try {
    const user = await models.login_data.findOne({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: {
          [Op.gt]: new Date().toISOString()
        }
      }
    })
    if (!user) return res.json({message: "No user was found"})

    const salt = authentication.makesalt();
    const updatedUser = await user.update(
      {
        password: newPass,
        salt: salt,
        resetPasswordToken: null,
        resetPasswordExpires: null
      }
    );

    //log user out of all devices
    const loggedOutUsers = await models.devices.update(
      {
        device_active: false
      },
      {where: {username: user.username, company_id: user.company_id}}
    )

    res.status(200).send('<html><body style="background-color:">' +
      '<div style="font-size:25px;padding: 35px;border-radius:6px;color: #ffffff;background-color: #19d800;border-color: #ffffff;">' +
      '<center>Password Changed Successfully</center></div></body></html>');
  } catch (e) {
    res.status(200).send('<html><body style="background-color:">' +
      '<div style="font-size:25px;padding: 35px;border-radius:6px;color: #ffffff;background-color: #ff0149;border-color: #ffffff;">' +
      '<center>There was a error at changing password</center></div></body></html>');
  }
}
/**
 * @api {post} /apiv4/auth/password/change Change Password
 * @apiVersion 4.0.0
 * @apiName ChangePassword
 * @apiGroup VOD_V4
 *
 * @apiHeader {String} x-access-token Users JWT token.
 * @apiParam {String} currentPassword Customer username.
 * @apiParam {String} newPassword Customer username.
 * @apiDescription Endpoint to change your password.
 * @apiSuccess (Success 200) {Object} response Response
 *
 * @apiErrorExample Error-Response:
 *  HTTP/1.1 500 Internal Server Error
 *   {
 *      "error": {
 *        "code": 51,
 *        "message": "Internal Error"
 *      }
 *   }
 */
exports.changePassword = async function(req, res) {
  const schema = Joi.object().keys({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().regex(/^(?=.*[0-9])(?=.*[a-zA-Z])([a-zA-Z0-9]+)$/).min(4).required()
  });

  const {error, value} = schema.validate({
    currentPassword: req.body.currentPassword,
    newPassword: req.body.newPassword
  });

  if (error) {
    return responseHandler.sendError(req, res, 400, 60)
  }

  const newPassword = value.newPassword;
  const currentPassword = value.currentPassword;

  if(currentPassword === newPassword) {
    return responseHandler.sendError(req, res, 400, 66);
  }

  try {
    const user = await models.login_data.findOne({
      where: {
        id: req.user.id
      }
    });

    const salt = user.salt;
    const checkExistingPass = authentication.encryptPassword(currentPassword, salt);

    if (checkExistingPass !== user.password) {
      return responseHandler.sendError(req, res, 401, 65);
    }

    const newSalt = authentication.makesalt();
    const encrypted_password = authentication.encryptPassword(newPassword, newSalt);

    await models.login_data.update(
      {
        password: encrypted_password, salt: newSalt
      },
      {where: { id: req.user.id }}
    );

    return responseHandler.sendData(req, res, true);
  } catch (e) {
    winston.error("Updating the account's password v4 failed with error: ", e);
    responseHandler.sendError(req, res, 500, 51);
  }
}

exports.loginToken = function (req, res) {
  models.app_group.findOne({
    attributes: ['app_group_id'],
    where: {app_id: req.auth.app_id}
  }).then(function (app_group) {
    models.devices.findAll({
      include: [{
        model: models.app_group,
        required: true,
        attributes: [],
        where: {app_group_id: app_group.app_group_id}
      }],
      where: {username: req.auth.username, device_active: true, device_id: {[Op.not]: req.auth.device_id}}
    }).then(function (device) {

      if (!device || device.length < Number(req.user.max_login_limit)) {
        upsertDevice({
          device_active: true,
          login_data_id: req.user.id,
          username: req.auth.username,
          device_mac_address: decodeURIComponent(req.auth.mac_address),
          appid: req.auth.app_id,
          app_name: (req.auth.app_name) ? req.auth.app_name : '',
          app_version: req.auth.app_version ? req.auth.app_version : "1.0.0",
          ntype: req.auth.ntype ? req.auth.ntype : 1,
          device_id: req.auth.device_id,
          hdmi: (req.body.hdmi == 'true') ? 1 : 0,
          firmware: decodeURIComponent(req.auth.firmware_version),
          device_brand: decodeURIComponent(req.auth.device_brand),
          screen_resolution: decodeURIComponent(req.auth.screen_size),
          api_version: decodeURIComponent(req.auth.api_version),
          device_ip: getClientIP(req),
          os: decodeURIComponent(req.auth.os),
          language: req.auth.language,
          company_id: req.auth.company_id,
        }).then(function (result) {
          const response = {
            company_id: req.user.company_id
          }
          return responseHandler.sendData(req, res, response)
        }).catch(function (error) {
          winston.error("device upsert error : ", error);
          responseHandler.sendError(req, res, 401, 51)
        });
      } else {
        responseHandler.sendError(req, res, 406, 5)
      }
      return null;
    }).catch(function (error) {
      winston.error("database error device search : ", error);
      responseHandler.sendError(req, res, 401, 51)
    });
    return null;
  }).catch(function (error) {
    winston.error("Searching for the app group's data failed with error: ", error);
    responseHandler.sendError(req, res, 401, 51)
  });

};