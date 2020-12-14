'use strict'

const path = require('path'),
  db = require(path.resolve('./config/lib/sequelize')),
  models = db.models,
  response = require('../utils/response'),
  winston = require('winston');
  const moment = require("moment");
  const  { Op } = require('sequelize');

/** DEVICE MENU GET
 * @api {get} /apiv4/main/device-menu DeviceMainMenu
 * @apiVersion 4.0.0
 * @apiName GetDeviceMenu
 * @apiGroup Main Menu
 *
 * @apiHeader {String} x-access-token Users JWT token.
 * @apiDescription Get Main Menu object for the running application.
 *
 *  @apiSuccessExample Success-Response:
 *   HTTP/1.1 200 OK
 *     {
 *       "data": [
 *         {
 *          "id": "number",
 *          "title": "string",
 *          "url": "string",
 *          "icon_url": "string",
 *          "icon": "string",
 *          "menu_code": "number",
 *          "position": "number",
 *          "menucode": "number",
 *        }
 *       ]
 *     }
 *
 *  @apiErrorExample Error-Response:
 *  HTTP/1.1 404 Not Found
 *   {
 *      "error": {
 *        "code": 34,
 *        "message": "Unable to find any device with the required specifications"
 *      }
 *   }
 * @apiErrorExample Error-Response:
 *  HTTP/1.1 500 Internal Server Error
 *   {
 *      "error": {
 *        "code": 51,
 *        "message": "Internal Error"
 *      }
 *   }
 */
exports.deviceMenu = async (req, res) => {
  try {
    let get_guest_menus = (req.auth.data.username === 'guest' && req.app.locals.backendsettings[req.auth.company_id].allow_guest_login === true) ? true : false;
    let result = await models.device_menu.findAll({
      attributes: ['id', 'title', 'url', 'icon_url', [db.sequelize.fn('concat', req.app.locals.backendsettings[req.auth.company_id].assets_url, db.sequelize.col('icon_url')), 'icon'],
        'menu_code', 'position', ['menu_code', 'menucode']],
      where: {
        appid: { [Op.like]: `%${req.auth.data.app_id}%` },
        isavailable: true,
        is_guest_menu: get_guest_menus,
        company_id: req.auth.company_id
      },
      order: [['position', 'ASC']]
    })

    if (!result.length) {
      return response.sendError(req, res, 204, 34);
    }

    for (let i = 0; i < result.length; i++) {
      result[i].icon_url = req.app.locals.backendsettings[req.auth.company_id].assets_url + result[i].icon_url;
    }
    response.sendData(req, res, result);
  } catch (error) {
    winston.error("Getting a list of menus failed with error: ", error);
    response.sendError(req, res, 500, 51);
  }
};

/** DEVICE MENU GET
 * @api {get} /apiv4/settings Settings
 * @apiVersion 4.0.0
 * @apiName GetSettings
 * @apiGroup Settings
 *
 * @apiHeader {String} x-access-token Users JWT token.
 * @apiDescription Get Settings for the device.
 *
 *  @apiSuccessExample Success-Response:
 *   HTTP/1.1 200 OK
 {
    "data": {
        "logo_url": "https://devapp.magoware.tv/1/files/settings/15910195327521564060742020LogoMagoWhite.png",
        "background_url": "https://devapp.magoware.tvundefined",
        "vod_background_url": "https://devapp.magoware.tv/1/files/settings/15910194512971564060715584vod.jpg",
        "portrait_background_url": "https://devapp.magoware.tv/1/files/settings/15910194843151559723221428MagowarePortrait.png",
        "online_payment_url": "https://www.youtube.com?username=klendi11",
        "subscription_expires_at": "2020-09-28T12:23:11.125Z",
        "company_url": "https://magoware.tv",
        "log_event_interval": 327,
        "channel_log_time": 5,
        "activity_timeout": 7200,
        "player": "default",
        "pin": "1234",
        "language": "eng",
        "show_adult": false,
        "get_ads": false,
        "vast_ad_url": "test"
    }
}
 *
 *  @apiErrorExample Error-Response:
 *  HTTP/1.1 404 Not Found
 *   {
 *      "error": {
 *        "code": 34,
 *        "message": "Unable to find any device with the required specifications"
 *      }
 *   }
 * @apiErrorExample Error-Response:
 *  HTTP/1.1 500 Internal Server Error
 *   {
 *      "error": {
 *        "code": 51,
 *        "message": "Internal Error"
 *      }
 *   }
 */
exports.settings = async (req, res) => {
  const user = req.user;
  const appId = req.auth.data.app_id;
  const activity = 'livetv';
  const screenSize = req.auth.data.screen_size;
  const companyId = user.company_id;

  try {
    const settings = req.app.locals.backendsettings[companyId];

    const appGroupAppId = await models.app_group.findOne({
      attributes: ['app_group_id'],
      where: {
        app_id: appId
      }
    });

    if(!appGroupAppId) {
      return response.sendError(req, res, 404, 70);
    }

    const subscription = await models.subscription.findAll({
      attributes: ['end_date'], where: {login_id: user.id},
      limit: 1,
      order: [['end_date', 'DESC']],
      include: [{
        model: models.package, required: true, attributes: ['id'],
        include: [
          {
            model: models.package_type,
            required: true,
            attributes: ['id'],
            where: {app_group_id: appGroupAppId.app_group_id},
            include: [
              {model: models.activity, required: true, attributes: ['id'], where: {description: activity}}
            ]
          }
        ]
      }
      ]
    });


    if (appId === '2' || appId === '3') {
      if (livetv_s_subscription_end[user.id]) {
        //destroy push task for live tv small screen for this user
        clearTimeout(livetv_s_subscription_end[user.id]);
        delete livetv_s_subscription_end[user.id];
      }
      if (vod_s_subscription_end[user.id]) {
        //destroy push task for vod small screen for this user
        clearTimeout(vod_s_subscription_end[user.id]);
        delete vod_s_subscription_end[user.id];
      }
    } else {
      if (livetv_l_subscription_end[user.id]) {
        //destroy push task for live tv large screen for this user
        clearTimeout(livetv_l_subscription_end[user.id]);
        delete livetv_l_subscription_end[user.id];
      }
      if (vod_l_subscription_end[user.id]) {
        //destroy push task for vod large screen for this user
        clearTimeout(vod_l_subscription_end[user.id]);
        delete vod_l_subscription_end[user.id];
      }
    }

    const endDateVal = subscription[0];
    const endDate = moment(endDateVal ? endDateVal.end_date : moment());

    //return images based on appid
    const isMobile = (appId === 2 || appId === 3);
    const logoUrl = isMobile ? settings.mobile_logo_url : settings.box_logo_url;
    const backgroundUrl = !isMobile ? screenSize.box_background_url : screenSize.mobile_background_url;

    const lang = languages[req.body.language] ? req.body.language : 'eng'; //handle missing language variables, serving english as default

    const data = {
      logo_url: settings.assets_url + logoUrl,
      background_url: settings.assets_url + backgroundUrl,
      vod_background_url: settings.assets_url + settings.vod_background_url,
      portrait_background_url: settings.assets_url + settings.portrait_background_url,
      online_payment_url: `${settings.online_payment_url}?username=${user.username}`,
      subscription_expires_at: endDate,
      company_url: settings.company_url,
      log_event_interval: settings.log_event_interval,
      channel_log_time: settings.channel_log_time,
      activity_timeout: Math.min(settings.activity_timeout, user.activity_timeout),
      player: user.player,
      pin: user.pin,
      language: lang,
      show_adult: user.show_adult,
      get_ads: user.get_ads,
      vast_ad_url: settings.vast_ad_url
    };

    response.sendData(req, res, data);
  } catch (e) {
    winston.error("Getting the settings failed with error: ", e);
    response.sendError(req, res, 500, 51);
  }

}