'use strict'
var path = require('path'),
  db = require(path.resolve('./config/lib/sequelize')),
  response = require(path.resolve("./config/responses.js")),
  models = db.models,
  fs = require('fs'),
  qr = require('qr-image'),
  winston = require(path.resolve('./config/lib/winston'));

const responses = require(path.resolve("./config/responses.js"));

const  { Op } = require('sequelize');

const Joi = require("joi")

var authentication = require(path.resolve('./modules/deviceapiv2/server/controllers/authentication.server.controller.js'));
var push_functions = require(path.resolve('./custom_functions/push_messages'));
const {generate_internal_hash_token_v2} = require("../../../streams/server/controllers/streamkeydelivery.server.controller");
const {getStreamServersLoad} = require("../../../mago/server/utils/getStreamServerLoad");

/**
 * @api {post} /apiv2/main/device_menu /apiv2/main/device_menu
 * @apiName DeviceMenu
 * @apiGroup DeviceAPI
 *
 * @apiUse body_auth
 * @apiDescription Returns list of menu items available for this user and device
 *
 * Use this token for testing purposes
 *
 * auth=gPIfKkbN63B8ZkBWj+AjRNTfyLAsjpRdRU7JbdUUeBlk5Dw8DIJOoD+DGTDXBXaFji60z3ao66Qi6iDpGxAz0uyvIj/Lwjxw2Aq7J0w4C9hgXM9pSHD4UF7cQoKgJI/D
 */
exports.device_menu = function (req, res) {
  var get_guest_menus = (req.authParams.auth.username === 'guest' && req.app.locals.backendsettings[req.authParams.companyId].allow_guest_login === true) ? true : false;
  models.device_menu.findAll({
    attributes: ['id', 'title', 'url', 'icon_url', [db.sequelize.fn('concat', req.app.locals.backendsettings[req.authParams.companyId].assets_url, db.sequelize.col('icon_url')), 'icon'],
      'menu_code', 'position', [db.sequelize.fn('concat', "", db.sequelize.col('menu_code')), 'menucode']],
    where: {
      appid: { [Op.like] : '%' + req.authParams.auth.appid + '%'},
      isavailable: true,
      is_guest_menu: get_guest_menus,
      company_id: req.authParams.companyId
    },
    order: [['position', 'ASC']]
  }).then(function (result) {
    for (var i = 0; i < result.length; i++) {
      result[i].icon_url = req.app.locals.backendsettings[req.authParams.companyId].assets_url + result[i].icon_url;
    }
    response.send_res(req, res, result, 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'private,max-age=86400');
  }).catch(function (error) {
    winston.error("Getting a list of menus failed with error: ", error);
    response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
  });
};


/** DEVICE MENU GET
 * @api {get} /apiv2/main/device_menu Get Device Main Menu
 * @apiVersion 0.2.0
 * @apiName GetDeviceMenu
 * @apiGroup Main Menu
 *
 * @apiHeader {String} auth Users unique access-key.
 * @apiDescription Get Main Menu object for the running application.
 */




exports.device_menu_get = function (req, res) {

  var get_guest_menus = (req.authParams.auth.username === 'guest' && req.app.locals.backendsettings[req.authParams.companyId].allow_guest_login === true) ? true : false;
  models.device_menu.findAll({
    attributes: ['id', 'title', 'url', 'icon_url', [db.sequelize.fn('concat', req.app.locals.backendsettings[req.authParams.companyId].assets_url, db.sequelize.col('icon_url')), 'icon'],
      'menu_code', 'position', ['menu_code', 'menucode']],
    where: {
      appid: {[Op.like]: '%' + req.authParams.auth.appid + '%'},
      isavailable: true,
      is_guest_menu: get_guest_menus,
      company_id: req.authParams.companyId
    },
    order: [['position', 'ASC']]
  }).then(function (result) {
    for (var i = 0; i < result.length; i++) {
      result[i].icon_url = req.app.locals.backendsettings[req.authParams.companyId].assets_url + result[i].icon_url;
    }

    response.send_res_get(req, res, result, 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'private,max-age=86400');

  }).catch(function (error) {
    winston.error("Getting a list of menus failed with error: ", error);
    response.send_res_get(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
  });
};


/** GET DEVICE MENU WITH TWO LEVELS - LEVEL ONE
 * @api {get} /apiv2/main/device_menu_levelone Get DeviceMenu level One
 * @apiVersion 0.2.0
 * @apiName GetDeviceMenuLevelOne
 * @apiGroup Main Menu
 *
 * @apiHeader {String} auth Users unique access-key.
 * @apiDescription Get Main Menu object for the running application.
 */
exports.get_devicemenu_levelone = function (req, res) {

  var get_guest_menus = (req.authParams.auth.username === 'guest' && req.app.locals.backendsettings[req.authParams.companyId].allow_guest_login === true) ? true : false;
  models.device_menu.findAll({
    attributes: ['id', 'title', 'url',
      [db.sequelize.fn('concat', req.app.locals.backendsettings[req.authParams.companyId].assets_url, db.sequelize.col('icon_url')), 'icon'],
      [db.sequelize.fn('concat', req.app.locals.backendsettings[req.authParams.companyId].assets_url, db.sequelize.col('icon_url')), 'icon_url'],
      'menu_code', 'position', 'parent_id', 'menu_description', ['menu_code', 'menucode']],
    where: {
      appid: {[Op.like]: '%' + req.authParams.auth.appid + '%'},
      isavailable: true,
      is_guest_menu: get_guest_menus,
      company_id: req.authParams.companyId
    },
    order: [['position', 'ASC']]
  }).then(function (result) {
    for (var i = 0; i < result.length; i++) {
      result[i].dataValues.menucode = 0;
      result[i].dataValues.menu_code = 0;
      result[i].dataValues.parent_id = 0;
    }
    response.send_res_get(req, res, result, 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'private,max-age=86400');
  }).catch(function (error) {
    winston.error("Getting a list of level one menus failed with error: ", error);
    response.send_res_get(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
  });
};


/** GET DEVICE MENU WITH TWO LEVELS - LEVEL TWO
 * @api {get} /apiv2/main/device_menu_leveltwo Get DeviceMenu level Two
 * @apiVersion 0.2.0
 * @apiName GetDeviceMenuLevelTwo
 * @apiGroup Main Menu
 *
 * @apiHeader {String} auth Users unique access-key.
 * @apiDescription Get Main Menu object for the running application.
 */
exports.get_devicemenu_leveltwo = function (req, res) {

  models.device_menu_level2.findAll({
    attributes: ['id', 'title', 'url',
      [db.sequelize.fn('concat', req.app.locals.backendsettings[req.authParams.companyId].assets_url, db.sequelize.col('icon_url')), 'icon'],
      [db.sequelize.fn('concat', req.app.locals.backendsettings[req.authParams.companyId].assets_url, db.sequelize.col('icon_url')), 'icon_url'],
      'menu_code', 'position', 'parent_id', 'menu_description', ['menu_code', 'menucode']],
    where: {appid: {[Op.like]: '%' + req.authParams.auth.appid + '%'}, isavailable: true, company_id: req.authParams.companyId},
    order: [['position', 'ASC']]
  }).then(function (result) {

    response.send_res_get(req, res, result, 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'private,max-age=86400');

  }).catch(function (error) {
    winston.error("Getting a list of second level menus failed with error: ", error);
    response.send_res_get(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
  });
};

exports.get_weather_widget = function (req, res) {

  if (fs.existsSync('public/weather_widget/index.html')) {
    var url = req.app.locals.backendsettings[req.thisuser.company_id].assets_url;
    var file = '/weather_widget/index.html';
    var response_Array = {
      "widget_url": url + file
    };
    return res.send(response_Array);
  } else {
    return res.status(404).send({
      message: 'Image Not Found'
    });
  }
};

exports.get_welcomeMessage = function (req, res) {

  models.customer_data.findOne({
    attributes: ['firstname', 'lastname'],
    where: {id: req.thisuser.customer_id}
  }).then(function (customer_data_result) {

    models.html_content.findOne({
      where: {name: 'welcomeMessage'}
    }).then(function (html_content_result) {

      var html;
      if (!html_content_result) {
        html = 'Welcome';
      } else {
        var content_from_ui = html_content_result.content;
        html = content_from_ui.replace(new RegExp('{{fullname}}', 'gi'), customer_data_result.firstname + ' ' + customer_data_result.lastname);
      }

      var response_Array = [{
        "welcomeMessage": html
      }];

      // response.set('Content-Type', 'text/html');
      response.send_res_get(req, res, response_Array, 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'private,max-age=86400');
      return null;

    }).catch(function (error) {
      winston.error("Html Content failed with error", error);
      response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
    });
    return false;
  }).catch(function (error) {
    winston.error("Quering for the client's personal info failed with error: ", error);
    response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
  });
};

exports.get_qrCode = function (req, res) {

  if (!req.body.googleid) {
    return res.send({error: {code: 400, message: 'googleid parameter null'}});
  } else {

    if (!fs.existsSync('./public/files/qrcode/')){
        fs.mkdirSync('./public/files/qrcode/');
     }

    let company_id = !req.headers.company_id ? 1 : req.headers.company_id;
    const url = req.app.locals.backendsettings[company_id].assets_url;
    const siteUrl = req.protocol + '://' + req.get('host');
    const d = new Date();
    const qr_png = qr.image(url + '/apiv2/htmlContent/remotedeviceloginform?googleid=' + req.body.googleid + '&url=' + siteUrl, {
      type: 'png',
      margin: 1,
      size: 5
    });
    qr_png.pipe(fs.createWriteStream('./public/files/temp/' + d.getTime() + 'qrcode.png'));
    const qrcode_image_fullpath = qr_png._readableState.pipes.path.slice(8);
    const qrcode_url = url + qrcode_image_fullpath;

    response.send_res_get(req, res, qrcode_url, 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'private,max-age=86400');

  }
};

exports.getloginform = function (req, res) {
  res.set('Content-Type', 'text/html');
  res.render(path.resolve('modules/deviceapiv2/server/templates/qrcode'), {
    googleid: req.query.googleid,
    serverUrl: req.query.url
  });
  return null;

};

exports.qr_login = function (req, res) {
  var login_params = {
    "username": req.body.username,
    "password": req.body.password
  };
  var push_obj = new push_functions.ACTION_PUSH('Action', 'Performing an action', 5, 'login_user', login_params);
  let company_id = req.headers.company_id ? req.headers.company_id : 1;
  push_functions.send_notification(req.body.googleid, req.app.locals.backendsettings[company_id].firebase_key, req.body.username, push_obj, 60, false, false, function (result) {
  });
  res.status(200).send({message: 'Message sent'});

};


/**
 * @api {post} /apiv3/arbiter/get/url Get Stream Url
 * @apiVersion 0.2.0
 * @apiName GetStreamUrl
 * @apiGroup DeviceAPI
 * @apiParam {String} content_path Content Path.
 * @apiParam {Boolean} hash_token enable hash token for streams.
 * @apiParam {String} auth Encrypted authentication token string.
 * @apiDescription Logs user out of devices of the same group as this. (Updates device_active flag to false, sends push notification to log user out)
 * @apiSuccessExample Success-Response:
 {
    "status_code": 200,
    "error_code": 1,
    "timestamp": 1,
    "error_description": "OK",
    "response_object": [
        {
            "url": "http://51.159.0.64:8082/program/stream/stream.m3u8"
        }
    ]
}
 * @apiErrorExample Error-Response:
 *     {
 *       "status_code": 704,
 *       "error_code": -1,
 *       "timestamp": 1,
 *       "error_description": "REQUEST_FAILED",
 *       "extra_data": "Error processing request",
 *       "response_object": []
 *     }
 * @apiErrorExample Error-Response:
 *     {
 *       "status_code": 704,
 *       "error_code": -1,
 *       "timestamp": 1,
 *       "error_description": "REQUEST_FAILED",
 *       "extra_data": "Unable to find any device with the required specifications",
 *       "response_object": []
 *     }
 * @apiErrorExample Error-Response:
 *     {
 *       "status_code": 704,
 *       "error_code": -1,
 *       "timestamp": 1,
 *       "error_description": "DATABASE_ERROR",
 *       "extra_data": "Error connecting to database",
 *       "response_object": []
 *     }
 */
exports.arbiter = async function (req, res) {

  const schema = Joi.object().keys({
    content_path: Joi.string().required(),
    hash_token: Joi.boolean().default(false),
    public_content: Joi.boolean().default(false)
  })

  const {error, value} = schema.validate(req.query);

  const { content_path, hash_token } = value;

  if (error) {
    return response.send_res_get(req, res, [], 400, -1, 'BAD_REQUEST_DESCRIPTION', 'BAD_REQUEST_DATA', 'no-store');
  }

  try {
    const companyId = req.headers.company_id ? req.headers.company_id : 1;

    let min;
    let server;

    const serversJson = await getStreamServersLoad();
    const servers = JSON.parse(serversJson);

    if (servers.length <= 0) {
      return response.send_res_get(req, res, [], 404, -1, 'NO_SERVER_AVAILABLE_FOR_STREAM', 'NO_SERVER_AVAILABLE_FOR_STREAM_DATA', 'no-store');
    }

    for (let i = 0; i < servers.length; i++) {
      const {connections, outRate, is_available} = servers[i];

      if(!is_available) {
        continue
      }

      if (connections >= servers[i].connections_threshold) {
        //we can't take it here, its full
        continue;
      }

      if (outRate >= servers[i].out_rate_threshold) {
        continue;
      }

      if (typeof min == "undefined") {
        min = connections;
        server = servers[i];
      }

      if (connections < min) {
        min = connections;
        server = servers[i];
      }
    }

    if (!server) {
      return response.send_res_get(req, res, [], 404, -1, 'NO_SERVER_AVAILABLE_FOR_STREAM', 'NO_SERVER_AVAILABLE_FOR_STREAM_DATA', 'no-store');
    }

    const finalResponse = new responses.OK();
    let hash = "";
    if(hash_token) {
      hash = generate_internal_hash_token_v2(req);

      if(!hash) hash = "";
    }
    finalResponse.extra_data = server.base_url + content_path + hash
    res.status(200).send(finalResponse)
  } catch (e) {
    response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
  }
}