'use strict'

const path = require('path'),
    winston = require('winston'),
    db = require(path.resolve('./config/lib/sequelize')),
    models = db.models,
    response = require(path.resolve('./config/responses'));

/**
 * @api {get} /apiv3/feeds/banners/big Get Big Banners
 * @apiVersion 0.3.0
 * @apiName GetBigBannners
 * @apiGroup FEEDS
 *
 * @apiDescription Get big banners for homepage
 * @apiSuccessExample Success-Response:
 * HTTP/1.1 200 OK
 * {
 *    "status_code": 200,
 *    "error_code": 1,
 *    "timestamp": 1,
 *    "error_description": "OK",
 *    "extra_data": "OK_DATA",
 *    "response_object": [
 *        {
 *            "id": 4,
 *            "name": "promotion",
 *            "img_url": "http://imgurl",
 *            "link": ""
 *        }
 *        ...
 *    ]
 * }
 * 
 * 
 * @apiErrorExample Error-Response:
 *  HTTP/1.1 200 OK
 *  {
 *     "status_code": 706,
 *     "error_code": -1,
 *     "timestamp": 1,
 *     "extra_data": "DATABASE_ERROR_DATA",
 *     "response_object": []
 *  }
 * 
 */
exports.handleGetBigBanners = function (req, res) {
    const companyId = req.headers.company_id || 1;
    const settings = req.app.locals.backendsettings[companyId];
    if (!settings) {
        response.send_res(req, res, [], 706, -1, 'COMPANY_NOT_FOUND_DESCRIPTION', 'COMPANY_NOT_FOUND_DATA', 'no-store');
        return;
    }

    models.banners.findAll({
        attributes: ['id', 'name', [db.sequelize.fn('concat', settings.assets_url, db.sequelize.col('banners.img_url')), 'img_url'], 'link'],
        where: { company_id: companyId, size: 'large' }
    }).then(function (banners) {
        response.send_res(req, res, banners, 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'private,max-age=7200');
    }).catch(function (err) {
        winston.error('Getting big banners failed with error: ', err);
        response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
    });
}

/**
 * @api {get} /apiv3/feeds/banners/small Get Small Banners
 * @apiVersion 0.3.0
 * @apiName GetSmallBannners
 * @apiGroup FEEDS
 *
 * @apiDescription Get Small banners for homepage
 * @apiSuccessExample Success-Response:
 * HTTP/1.1 200 OK
 * {
 *    "status_code": 200,
 *    "error_code": 1,
 *    "timestamp": 1,
 *    "error_description": "OK",
 *    "extra_data": "OK_DATA",
 *    "response_object": [
 *        {
 *            "id": 4,
 *            "name": "promotion",
 *            "img_url": "http://imgurl",
 *            "link": ""
 *        }
 *        ...
 *    ]
 * }
 * 
 * 
 * @apiErrorExample Error-Response:
 *  HTTP/1.1 200 OK
 *  {
 *     "status_code": 706,
 *     "error_code": -1,
 *     "timestamp": 1,
 *     "extra_data": "DATABASE_ERROR_DATA",
 *     "response_object": []
 *  }
 * 
 */
exports.handleGetSmallBanners = function (req, res) {
    const companyId = req.headers.company_id || 1;
    const settings = req.app.locals.backendsettings[companyId];
    if (!settings) {
        response.send_res(req, res, [], 706, -1, 'COMPANY_NOT_FOUND_DESCRIPTION', 'COMPANY_NOT_FOUND_DATA', 'no-store');
        return;
    }

    models.banners.findAll({
        attributes: ['id', 'name', [db.sequelize.fn('concat', settings.assets_url, db.sequelize.col('banners.img_url')), 'img_url'], 'link'],
        where: { company_id: companyId, size: 'small' }
    }).then(function (banners) {
        response.send_res(req, res, banners, 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'private,max-age=7200');
    }).catch(function (err) {
        winston.error('Getting big banners failed with error: ', err);
        response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
    });
}