'use strict';
const path = require('path'),
    db = require(path.resolve('./config/lib/sequelize')),
    sequelize = require('sequelize'),
    sequelize_instance = require(path.resolve('./config/lib/sequelize')),
    response = require(path.resolve("./config/responses.js")),
    models = db.models,
    winston = require(path.resolve('./config/lib/winston')),
    escape = require(path.resolve('./custom_functions/escape'));
const config = require(path.resolve('./config/config'));
const moment = require('moment');
const axios = require('axios');
const sqlstring = require('sqlstring');
const { Op } = require('sequelize');
const Joi = require('joi');
const { join } = require('path');
const { isInt } = require('../../../../custom_functions/validator');

async function getMovieTMDbId(title) {
  try {
    let gettmdbid = await axios.get('https://api.themoviedb.org/3/search/movie', {
      params: {
        api_key: 'e76289b7e0306b6e6b6088148b804f01',
        language: "en-US",
        query: title
      }
    })
    if (!gettmdbid || gettmdbid.data.results.length === 0) {
      return Promise.resolve({ tmdb_values: { tmdbId: -1 } });
    } else {
      return Promise.resolve({ tmdb_values: { tmdbId: gettmdbid.data.results[0].id } });
    }
  } catch (error) {
    return Promise.resolve({ tmdb_values: { tmdbId: -1 } });
  }
}

/**
 * @api {get} /apiv3/vod/vod_details/:vod_id Get Vod Item Details
 * @apiName GetVodItemDetails
 * @apiGroup VOD_V3
 *
 * @apiUse header_auth
 *
 *@apiDescription Returns information about a vod item, such as production info, subtitles and stream. Validation (expiration, pin protection etc) should be done in a previous request
 *
 * Copy paste this auth for testing purposes
 *auth=%7Bapi_version%3D22%2C+appversion%3D1.1.4.2%2C+screensize%3D480x800%2C+appid%3D2%2C+devicebrand%3D+SM-G361F+Build%2FLMY48B%2C+language%3Deng%2C+ntype%3D1%2C+app_name%3DMAGOWARE%2C+device_timezone%3D2%2C+os%3DLinux%3B+U%3B+Android+5.1.1%2C+auth%3D8yDhVenHT3Mp0O2QCLJFhCUfT73WR1mE2QRc1ZE7J22cRfmskdTmhCk9ssGWhoIBpIzoTEOLIqwl%0A47NaUwLoLZjH1i2WRYaiioIRMqhRvH2FsSuf1YG%2FFoT9fEw4CrxF%0A%2C+hdmi%3Dfalse%2C+firmwareversion%3DLMY48B.G361FXXU1APB1%7D
 *
 */
exports.get_movie_details = function (req, res) {
    models.vod_resume.findOne({
        where: { vod_id: req.params.vod_id, login_id: req.thisuser.id }
    }).then(function (result) {
        if (!result) {
            //var current_date = dateFormat(Date.now(), "yyyy-mm-dd HH:MM:ss");
            db.models.vod_resume.create(
                {
                    login_id: req.thisuser.id,
                    vod_id: req.params.vod_id,
                    company_id: req.thisuser.company_id,
                    resume_position: 0,
                    reaction: req.params.reaction,
                    device_id: req.auth_obj.boxid,
                    seen_details: true,
                    vod_type: 'film',
                    favorite: 0,
                    percentage_position: 0
                });
        } else {

            db.models.vod_resume.findOne({
                where: {
                    login_id: req.thisuser.id,
                    vod_id: req.params.vod_id,
                }
            }).then(vod_resume => {
                return vod_resume.increment('seen_details'); // assumes `option` always exists
            }).then(vod_resume => {
                return vod_resume.reload();
            }).then(vod_resume => {
                //res.json(vod_resume);
                const inc_seen_details = vod_resume.seen_details;

                models.vod_resume.update(
                    {
                        login_id: req.thisuser.id,
                        vod_id: req.params.vod_id,
                        company_id: req.thisuser.company_id,
                        device_id: req.auth_obj.boxid,
                        seen_details: inc_seen_details
                    },
                    { where: { id: vod_resume.id } });
            });
        }
    });

    var transactional_vod_duration = req.app.locals.backendsettings[req.thisuser.company_id].t_vod_duration;
    var attributes = [
        'id', ['adult_content', 'adult'], 'homepage', 'budget', 'mandatory_ads', 'imdb_id', 'original_language', 'original_title', 'expiration_time', 'price',
        ['starring', 'cast'], 'director', [db.sequelize.fn('YEAR', db.sequelize.col('release_date')), "release_year"], [sequelize.literal('"film"'), 'vod_type'],
        [db.sequelize.fn("concat", req.app.locals.backendsettings[req.thisuser.company_id].assets_url, db.sequelize.col('image_url')), 'backdrop_path'],
        [db.sequelize.fn("concat", req.app.locals.backendsettings[req.thisuser.company_id].assets_url, db.sequelize.col('vod.icon_url')), 'poster_path'],
        ['description', 'overview'], 'popularity', 'revenue', ['duration', 'runtime'], 'vote_count', 'trailer_url', 'vod_preview_url', 'default_subtitle_id',
        [sequelize.fn('DATE_FORMAT', sequelize.col('release_date'), '%Y-%m-%d'), 'release_date'], 'spoken_languages', 'status', 'tagline', 'title', 'vote_average', 'pin_protected'
    ];
    var vod_join_list = [
        {
            model: models.vod_stream,
            attributes: ['stream_format', 'drm_platform', 'url', 'token', 'token_url', 'encryption', 'encryption_url', 'stream_type', 'thumbnail_url'],
            required: false,
            where: {
                stream_source_id: req.thisuser.vod_stream_source,
                stream_resolution: { [Op.like]: "%" + req.auth_obj.appid + "%" }
            }
        },
        {
            model: models.vod_subtitles, required: false,
            attributes: ['id', 'title', [db.sequelize.fn("concat", req.app.locals.backendsettings[req.thisuser.company_id].assets_url, db.sequelize.col('subtitle_url')), 'url'], ['vod_id', 'vodid']]
        },
        {
            model: models.vod_vod_categories,
            attributes: ['id'],
            include: [{ model: models.vod_category, attributes: ['id', 'name'], required: false }]
        },
        {
            model: models.t_vod_sales,
            attributes: ['id'],
            required: false,
            where: { login_data_id: req.thisuser.id, vod_id: req.params.vod_id, end_time: { [Op.gte]: Date.now() } }
        },
        {
            model: models.vod_resume,
            attributes: ['resume_position', 'reaction', 'vod_type', 'favorite', 'percentage_position', 'favorite'],
            required: false,
            where: { login_id: req.thisuser.id }
        }
    ];
    var subscription_join_list = [
        {
            model: models.package,
            attributes: ['id'],
            required: true,
            where: { package_type_id: req.auth_obj.screensize + 2 },
            include: [
                { model: models.package_vod, attributes: ['id'], where: { vod_id: req.params.vod_id }, required: true }
            ]
        }
    ];

    models.vod.findOne({
        attributes: attributes,
        include: vod_join_list,
        where: { id: req.params.vod_id, isavailable: true, expiration_time: { [Op.gte]: Date.now() } }
    }).then(async (result) => {
        if (!result) {
            response.send_res_get(req, res, [], 200, 1, 'NOT_FOUND_DESCRIPTION', 'NO_DATA_FOUND', 'private,max-age=86400');
        } else {

            let getTMBDid = await getMovieTMDbId(result.original_title || result.title);
            result.dataValues = { ...result.dataValues, ...getTMBDid };

            models.subscription.findOne({
                attributes: ['id'],
                where: { login_id: req.thisuser.id, end_date: { [Op.gte]: Date.now() } },
                include: subscription_join_list,
                subQuery: false //prevent generation of subqueries, which can cause valid subscriptions not being returned
            }).then(function (subscription_result) {
                var available_purchase = ((result.t_vod_sales && result.t_vod_sales.length > 0)) ? true : false;
                var available_for_purchase = (transactional_vod_duration && (moment(result.expiration_time) > moment().add(transactional_vod_duration, 'day')) && (result.price > 0)) ? true : false;
                if (!subscription_result && !available_purchase && !available_for_purchase) {
                    response.send_res_get(req, res, [], 200, 1, 'NOT_FOUND_DESCRIPTION', 'NO_DATA_FOUND', 'private,max-age=86400');
                } else {
                    return models.vod_resume.findOne({
                        attributes: ['id', 'reaction'],
                        where: { login_id: req.thisuser.id, vod_id: req.params.vod_id },
                        order: [['updatedAt', 'DESC']],
                    }).then(function (vod_resume_reaction) {
                        var reaction = vod_resume_reaction;
                        var vod_data = {};
                        vod_data = result.toJSON(); //convert query results from instance to JSON, to modify it
                        vod_data.user_reaction = reaction;
                        //prepare dynamic button list based on client rights to play the item
                        vod_data.actions = [
                            { name: "related", description: languages[req.body.language].language_variables["RELATED"] },
                            { name: "trailer", description: languages[req.body.language].language_variables["TRAILER"] },
                            { name: "thumbup", description: languages[req.body.language].language_variables["THUMBUP"] },
                            {
                                name: "thumbdown",
                                description: languages[req.body.language].language_variables["THUMBDOWN"]
                            }
                        ];
                        //return play action for purchased movies, or those part of an active subscription
                        if (available_purchase || subscription_result) vod_data.actions.push({
                            name: "play",
                            description: languages[req.body.language].language_variables["PLAY"]
                        });
                        //return buy action for movies that can't be played, but are available to buy (price>0) and don't expire before the purchase's end time
                        else if (available_for_purchase) vod_data.actions.push({
                            name: "buy",
                            description: languages[req.body.language].language_variables["BUY"]
                        });
                        delete vod_data.t_vod_sales;
                        //find and asign value of default subtitle
                        if (result.vod_subtitles) {
                            try {
                                var found = result.vod_subtitles.find(function (x) {
                                    if (x.id === (result.default_subtitle_id)) {
                                        return x.title;
                                    }
                                }).title;
                            } catch (error) {
                                var found = "";
                            }
                        }
                        delete vod_data.default_subtitle_id;
                        vod_data.default_language = found;
                        //prepare array of categories
                        vod_data.genres = [];
                        for (var i = 0; i < vod_data.vod_vod_categories.length; i++) vod_data.genres.push({
                            "id": vod_data.vod_vod_categories[i].vod_category.id,
                            "name": vod_data.vod_vod_categories[i].vod_category.name
                        });
                        delete vod_data.vod_vod_categories;
                        //prepare stream object
                        vod_data.vod_stream = (vod_data.vod_streams && vod_data.vod_streams[0]) ? vod_data.vod_streams[0] : {};
                        delete vod_data.vod_streams;
                        //add url where client can buy a movie
                        vod_data.payment_url = req.app.locals.backendsettings[req.thisuser.company_id].assets_url + "/apiv3/vod_payment/vod_purchase/" + vod_data.id + '/' + req.thisuser.username;
                        //prepare ads object
                        vod_data.watch_mandatory_ad = {
                            "get_ads": (req.thisuser.get_ads || vod_data.mandatory_ads) ? 1 : 0,
                            "vast_ad_url": "https://servedbyadbutler.com/vast.spark?setID=5291&ID=173381&pid=57743"
                        };
                        delete vod_data.mandatory_ads;
                        //prepare position and reaction object
                        if (vod_data.vod_resumes.length < 1) vod_data.vod_resumes = {
                            "resume_position": 0,
                            "reaction": 0
                        };
                        else vod_data.vod_resumes = vod_data.vod_resumes[0];
                        response.send_res_get(req, res, [vod_data], 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'private,max-age=86400');
                    })
                }
            }).catch(function (error) {
                winston.error("Querying for the user's subscription failed with error: ", error);
                response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
            });
        }
    }).catch(function (error) {
        winston.error("Querying for the details of the vod item failed with error: ", error);
        response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
    });
};

exports.buy_vod_item = function (req, res) {
    var transactional_vod_duration = req.app.locals.backendsettings[req.thisuser.company_id].t_vod_duration;
    var end_date = moment().add(transactional_vod_duration, 'day').format();
    models.vod.findOne({
        attributes: ['title', 'icon_url', 'price', 'company_id'],
        where: {id: req.params.vod_id, isavailable: true, price: {[Op.gt]: 0}, expiration_time: {[Op.gt]: end_date}}
    }).then(function (vod_data) {
        let template = "";
        if (vod_data) {
            const payment_confirmation_url = req.app.locals.backendsettings[vod_data.company_id].assets_url + '/apiv2/payments/stripe/form/' + req.params.vod_id + '/' + req.params.client_username + '/' + vod_data.company_id;
            template = '<!DOCTYPE html>' +
                '<html lang="en" xmlns="http://www.w3.org/1999/xhtml"><head><title></title></head>' +
                '<body>' +
                '<p>Dear ' + req.params.client_username + ',</p><p>Welcome to ' + config.app.title +
                '</p><p>Please click the link below to confirm your purchase of the film ' + vod_data.title + ':</p>' +
                '<img src="' + req.app.locals.backendsettings[vod_data.company_id].assets_url + vod_data.icon_url + '" alt="' + vod_data.title + '" width="360" height="516">' +
                '<p><a href="' + payment_confirmation_url + '">Buy Film</a></p>' +
                '</body>' +
                '</html>';
        } else {
            template = '<!DOCTYPE html>' +
                '<html lang="en" xmlns="http://www.w3.org/1999/xhtml"><head><title></title></head>' +
                '<body>' +
                '<p>Dear ' + req.params.client_username + ',</p><p>Welcome to ' + config.app.title +
                '</p><p>The film you requested is no longer available to purchace. Please contact our customer care for further details.</p>' +
                '</body>' +
                '</html>';
        }
        res.send(template);
        return null;
    }).catch(function (error) {
        winston.error("Getting the data of the vod item failed with error: ", error);
        res.send(error);
    });
};


/**
 * @api {get} /apiv3/vod/vod_list Get Vod List
 * @apiName GetVodList
 * @apiGroup VOD_V3
 *
 * @apiUse header_auth
 *
 * @apiParam {Number} [page] Page (pagination) number. If missing, returns first page
 * @apiParam {String} [search]  Partial search string. Searches in following fields: title, original_title, description, tagline, cast, director
 * @apiParam {String} [pin_protected]  Unless specified otherwise, return only items that are not pin protected. Value set [true, false]
 * @apiParam {String} [show_adult]  Unless specified otherwise, return only items that are not adult content. Value set [true, false]
 * @apiParam {Number} [category_id] Filter vod items by category id
 * @apiParam {String} [order_by] Orders items by a specified field. Creation date is the default. Value set is [clicks, rate, vote_average, vote_count, popularity, duration, pin_protected, adult_content, isavailable, expiration_time, price, revenue, budget, release_date]
 * @apiParam {String} [order_dir] Order direction. Descending is default. Value set is [desc, asc]
 *
 *@apiDescription Returns paginated list of movies. Number of items per page is specified in the company settings (30 by default).
 *
 * Expired and non-available movies are not returned. By default, pin protected or adult movies are not returned, unless specified otherwise.
 *
 * Only movies belonging to at least a genre are returned.
 *
 * Copy paste this auth for testing purposes
 *auth=%7Bapi_version%3D22%2C+appversion%3D1.1.4.2%2C+screensize%3D480x800%2C+appid%3D2%2C+devicebrand%3D+SM-G361F+Build%2FLMY48B%2C+language%3Deng%2C+ntype%3D1%2C+app_name%3DMAGOWARE%2C+device_timezone%3D2%2C+os%3DLinux%3B+U%3B+Android+5.1.1%2C+auth%3D8yDhVenHT3Mp0O2QCLJFhCUfT73WR1mE2QRc1ZE7J22cRfmskdTmhCk9ssGWhoIBpIzoTEOLIqwl%0A47NaUwLoLZjH1i2WRYaiioIRMqhRvH2FsSuf1YG%2FFoT9fEw4CrxF%0A%2C+hdmi%3Dfalse%2C+firmwareversion%3DLMY48B.G361FXXU1APB1%7D
 *
 */
exports.get_vod_list = function (req, res) {
    const page_length = (req.app.locals.backendsettings[req.thisuser.company_id].vod_subset_nr) ? req.app.locals.backendsettings[req.thisuser.company_id].vod_subset_nr : 30; //max nr of movies in the response
    if (!req.query.page) req.query.page = 1; //if page param is missing, set page to 1
    let final_where = {};
    final_where.where = {};

    //set range of movies
    final_where.offset = (!req.query.page) ? 0 : (((parseInt(req.query.page) - 1)) * page_length);
    final_where.limit = page_length;

    //attribute list
    final_where.attributes = [
        'id', 'vote_count', 'vote_average', 'title', 'popularity', [sequelize.literal('"film"'), 'vod_type'], 'trailer_url', 'price', 'expiration_time',
        [db.sequelize.fn("concat", req.app.locals.backendsettings[req.thisuser.company_id].assets_url, db.sequelize.col('image_url')), 'backdrop_path'],
        [db.sequelize.fn("concat", req.app.locals.backendsettings[req.thisuser.company_id].assets_url, db.sequelize.col('vod.icon_url')), 'poster_path'],
        'original_language', 'original_title', ['adult_content', 'adult'], ['description', 'overview'], [sequelize.fn('DATE_FORMAT', sequelize.col('release_date'), '%Y-%m-%d'), 'release_date'], 'pin_protected'
    ];

    final_where.group = "vod.id";

    //prepare search condition by keyword
    if (req.query.search) {
        const q = decodeURIComponent(req.query.search);
        const like = { [Op.like]: sqlstring.format("?", ["%" + q.trim() + "%"]).replace(new RegExp("'", 'g'), "") };
        final_where.where = Object.assign(final_where.where, {
            [Op.or]: {
                title: like,
                original_title: like,
                description: like
            }
        })
    }

    //filter list
    final_where.where.isavailable = true; //return only available movies
    final_where.where.company_id = req.thisuser.company_id;
    final_where.where.expiration_time = {[Op.gte]: Date.now()};
    final_where.where.pin_protected = (req.query.pin_protected === 'true') ? {[Op.in]: [true, false]} : false; //pin protected content returned only if request explicitly asks for it
    final_where.where.adult_content = (req.query.adult_content === 'true') ? {[Op.in]: [true, false]} : false; //adult content returned only if request explicitly asks for it

    //prepare order clause
    const order_by = (req.query.order_by) ? req.query.order_by : 'createdAt';
    const order_dir = (req.query.order_dir) ? req.query.order_dir : 'DESC';
    final_where.order = [[order_by, order_dir]];

    const vod_vod_category_filter = (req.query.category_id) ? {category_id: Number(req.query.category_id)} : {vod_id: {[Op.gt]: 0}}; //if specified, filter by category id
    const vod_category_filter = {password: req.query.pin_protected === 'true' ? {[Op.in]: [true, false]} : false};  //show vods of categories with password only if requested.

    final_where.subQuery = false; //keeps subquery from generating
    final_where.distinct = true;

    models.package.findAll({
        attributes: ['id'],
        where: {package_type_id: req.auth_obj.screensize + 2},
        include: [{
            model: models.subscription,
            required: true,
            attributes: ['id'],
            where: {login_id: req.thisuser.id, end_date: {[Op.gte]: Date.now()}}
        }]
    }).then(function (packages) {
        let package_list = [];
        for (let i = 0; i < packages.length; i++) {
            package_list.push(packages[i].id);
        }
        //join tables
        final_where.include = [
            {
                model: models.vod_vod_categories, required: true, attributes: [], where: vod_vod_category_filter,
                include: [{model: models.vod_category, attributes: [], where: vod_category_filter}]
            },
            {model: models.package_vod, required: true, attributes: [], where: {package_id: {[Op.in]: package_list}}}
        ];
        //search for vod
        models.vod.findAndCountAll(
            final_where
        ).then(function (results) {
            const vod_list = {
                page: Number(req.query.page), //page number
                total_results: results.count.length, //number of vod items in total for this user. This is a maximum bound, not the exact number
                total_pages: Math.ceil(results.count.length / page_length), //number of pages for this user. This is a maximum bound, not the exact number
                results: results.rows //return found records
            };

            res.setHeader("X-Total-Count", results.count.length);
            response.send_res_get(req, res, vod_list, 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'private,max-age=86400');
        }).catch(function (error) {
            winston.error("Getting the movie list failed with error: ", error);
            response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
        });
        return null;
    }).catch(function (error) {
        winston.error("Getting the vod package list failed with error: ", error);
        response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
    });
};


/**
 * @api {put} /apiv3/vod/reaction/:vod_id/:reaction Send VOD Reaction
 * @apiVersion 0.3.0
 * @apiName SendVodReaction
 * @apiGroup VOD_V3
 *
 * @apiUse header_auth
 * @apiParam {Integer} vod_id The id of movie.
 * @apiParam {Integer} reaction The value of reaction for movie: -1 (thumbs down), 0 (remove thumb down/up), 1 (thumbs up).
 * @apiDescription Saves client reaction for a movie. Reaction values are -1 (thumbs down), 0 (remove thumb down/up), 1 (thumbs up)
 *
 * Also saves watch position. Watch position should be an integer in the interval ]0, 100[
 *
 * Copy paste this auth for testing purposes
 *auth=%7Bapi_version%3D22%2C+appversion%3D1.1.4.2%2C+screensize%3D480x800%2C+appid%3D2%2C+devicebrand%3D+SM-G361F+Build%2FLMY48B%2C+language%3Deng%2C+ntype%3D1%2C+app_name%3DMAGOWARE%2C+device_timezone%3D2%2C+os%3DLinux%3B+U%3B+Android+5.1.1%2C+auth%3D8yDhVenHT3Mp0O2QCLJFhCUfT73WR1mE2QRc1ZE7J22cRfmskdTmhCk9ssGWhoIBpIzoTEOLIqwl%0A47NaUwLoLZjH1i2WRYaiioIRMqhRvH2FsSuf1YG%2FFoT9fEw4CrxF%0A%2C+hdmi%3Dfalse%2C+firmwareversion%3DLMY48B.G361FXXU1APB1%7D
 *
 */
exports.reaction = async function (req, res) {
    if (!isInt(req.params.vod_id, {min: 0})) {
        response.send_res_get(req, res, [], 400, -1, 'BAD_REQUEST_DESCRIPTION', 'BAD_REQUEST_DATA', 'no-store');
        return;
    }

    if (!isInt(req.params.reaction, {min: -1, max: 1})) {
        response.send_res_get(req, res, [], 400, -1, 'BAD_REQUEST_DESCRIPTION', 'BAD_REQUEST_DATA', 'no-store');
        return;
    }

    try {
        let vod = await models.vod.findOne({
            attributes: ['id'],
            where: {
                id: req.params.vod_id,
            }
        });

        if (!vod) {
            response.send_res_get(req, res, [], 400, -1, 'BAD_REQUEST_DESCRIPTION', 'BAD_REQUEST_DATA', 'no-store');
            return;
        }

        await models.vod_resume.upsert({
            login_id: req.thisuser.id,
            vod_id: req.params.vod_id,
            company_id: req.thisuser.company_id,
            //resume_position: vod_resume.resume_position,
            reaction: req.params.reaction,
            device_id: req.auth_obj.boxid
        });

        response.send_res_get(req, res, [], 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'no-store');
    }
    catch(err) {
        winston.error("Saving the client's reaction for the movie failed with error: ", err);
        response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
    }
};


/**
 * @api {put} /apiv3/vod/favorite/:vod_id/:favorite Send VOD Favorite
 * @apiVersion 0.3.0
 * @apiName SendVodFavorite
 * @apiGroup VOD_V3
 *
 * @apiUse header_auth
 * @apiParam {Integer} vod_id The id of movie.
 * @apiParam {Integer} favorite The value of favorite for movie: 0 (default), 1 (favorite/watchlist).
 * @apiDescription Saves vod favorite for a movie. Favorite values are 0 (default), 1 (favorite/watchlist)
 *
 *
 * Copy paste this auth for testing purposes
 *auth=%7Bapi_version%3D22%2C+appversion%3D1.1.4.2%2C+screensize%3D480x800%2C+appid%3D2%2C+devicebrand%3D+SM-G361F+Build%2FLMY48B%2C+language%3Deng%2C+ntype%3D1%2C+app_name%3DMAGOWARE%2C+device_timezone%3D2%2C+os%3DLinux%3B+U%3B+Android+5.1.1%2C+auth%3D8yDhVenHT3Mp0O2QCLJFhCUfT73WR1mE2QRc1ZE7J22cRfmskdTmhCk9ssGWhoIBpIzoTEOLIqwl%0A47NaUwLoLZjH1i2WRYaiioIRMqhRvH2FsSuf1YG%2FFoT9fEw4CrxF%0A%2C+hdmi%3Dfalse%2C+firmwareversion%3DLMY48B.G361FXXU1APB1%7D
 *
 */
exports.favorite = function (req, res) {
    const validateParams = Joi.object({
        favorite: Joi.number().integer().min(0).max(1).required(),
        vod_id: Joi.number().integer().required()

    })
    const { error, value } = validateParams.validate({
        favorite : req.params.favorite,
        vod_id : req.params.vod_id
    })
    if (error) {
        winston.error('Error at validating params at vod v3', error.message);
        return response.send_res_get(req, res, [], 400, -1, 'BAD_REQUEST_DESCRIPTION', 'BAD_REQUEST_DATA', 'no-store');
    }
    models.vod_resume.findOne({
        where: {
            login_id: req.thisuser.id,
            vod_id: value.vod_id,
        }
    }).then(vod_resume => {
        if (!vod_resume) {
            models.vod_resume.create(
                {
                    login_id: req.thisuser.id,
                    vod_id: value.vod_id,
                    company_id: req.thisuser.company_id,
                    device_id: req.auth_obj.boxid,
                    favorite: value.favorite
                }).then(function (result) {
                response.send_res(req, res, [], 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'no-store');
            }).catch(function (error) {
                winston.error("Saving the client's favorite movie failed with error: ", error);
                response.send_res_get(req, res, [], 404, -1, 'NOT_FOUND_DESCRIPTION', 'NOT_FOUND_DATA', 'no-store');
            });
        }
        models.vod_resume.upsert(
            {
                login_id: req.thisuser.id,
                vod_id: value.vod_id,
                company_id: req.thisuser.company_id,
                device_id: req.auth_obj.boxid,
                favorite: value.favorite
            }).then(function (result) {
            response.send_res(req, res, [], 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'no-store');
        }).catch(function (error) {
            winston.error("Saving the client's favorite movie failed with error: ", error);
            response.send_res_get(req, res, [], 404, -1, 'NOT_FOUND_DESCRIPTION', 'NOT_FOUND_DATA', 'no-store');
        });
    }).catch(function (error) {
        winston.error("Saving the client's favorite movie failed with error: ", error);
        response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
    });
};


/**
 * @api {put} /apiv3/vod/resume_position/:vod_id/:resume_position Send VOD Resume Position
 * @apiName SendVodResumePosition
 * @apiGroup VOD_V3
 *
 * @apiUse header_auth
 *
 *@apiDescription Saves client resume position. Watch position should be an integer in the interval ]0, 100[
 *
 *
 * Copy paste this auth for testing purposes
 *auth=%7Bapi_version%3D22%2C+appversion%3D1.1.4.2%2C+screensize%3D480x800%2C+appid%3D2%2C+devicebrand%3D+SM-G361F+Build%2FLMY48B%2C+language%3Deng%2C+ntype%3D1%2C+app_name%3DMAGOWARE%2C+device_timezone%3D2%2C+os%3DLinux%3B+U%3B+Android+5.1.1%2C+auth%3D8yDhVenHT3Mp0O2QCLJFhCUfT73WR1mE2QRc1ZE7J22cRfmskdTmhCk9ssGWhoIBpIzoTEOLIqwl%0A47NaUwLoLZjH1i2WRYaiioIRMqhRvH2FsSuf1YG%2FFoT9fEw4CrxF%0A%2C+hdmi%3Dfalse%2C+firmwareversion%3DLMY48B.G361FXXU1APB1%7D
 *
 */
exports.resume_position = function (req, res) {

    models.vod_resume.upsert(
        {
            login_id: req.thisuser.id,
            vod_id: req.params.vod_id,
            company_id: req.thisuser.company_id,
            resume_position: req.params.resume_position,
            reaction: req.params.reaction,
            device_id: req.auth_obj.boxid,
            seen_details: req.params.seen_details,
            vod_type: 'film'
        }
    )
        .then(function (result) {
            response.send_res_get(req, res, [], 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'no-store');
        }).catch(function (error) {
        winston.error("Saving the client's resume position for the movie failed with error: ", error);
        response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
    });

};


/**
 * @api {get} /apiv3/vod/get_random_movie Get Random Movie
 * @apiName GetRandomMovie
 * @apiGroup VOD_V3
 * @apiUse header_auth
 * @apiParam {String} [show_adult]  If set to true, include items with adult content. Value set ['true', 'false']
 * @apiParam {String} [pin_protected]  If set to true, include pin protected items. Value set ['true', 'false']
 * @apiDescription The details for a random movie. Non-available or expired movies are not returned.
 *
 * Unless specified otherwise, pin protected and adult movies are not returned.
 *
 * Copy paste this auth for testing purposes
 * auth=%7Bapi_version%3D22%2C+appversion%3D1.1.4.2%2C+screensize%3D480x800%2C+appid%3D2%2C+devicebrand%3D+SM-G361F+Build%2FLMY48B%2C+language%3Deng%2C+ntype%3D1%2C+app_name%3DMAGOWARE%2C+device_timezone%3D2%2C+os%3DLinux%3B+U%3B+Android+5.1.1%2C+auth%3D8yDhVenHT3Mp0O2QCLJFhCUfT73WR1mE2QRc1ZE7J22cRfmskdTmhCk9ssGWhoIBpIzoTEOLIqwl%0A47NaUwLoLZjH1i2WRYaiioIRMqhRvH2FsSuf1YG%2FFoT9fEw4CrxF%0A%2C+hdmi%3Dfalse%2C+firmwareversion%3DLMY48B.G361FXXU1APB1%7D
 *
 */
exports.get_random_vod_item = function (req, res, next) {

    var random_where = {isavailable: true, expiration_time: {[Op.gte]: Date.now()}};
    random_where.adult_content = (req.query.show_adult === 'true') ? {[Op.in]: [true, false]} : false; //adult content returned only if request explicitly asks for it
    random_where.pin_protected = (req.query.pin_protected === 'true') ? {[Op.in]: [true, false]} : false; //pin protected content returned only if request explicitly asks for it
    random_where.company_id = req.thisuser.company_id;

    models.vod.findOne({
        attributes: ['id'],
        where: random_where,
        order: sequelize.fn('RAND')
    }).then(function (result) {
        req.params.vod_id = result.id;
        next();
        return null;
    }).catch(function (error) {
        winston.error("Getting a random movie failed with error: ", error);
        response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
    });
};


/**
 * @api {get} /apiv3/vod/vod_related/:vod_id Get Related Movies
 * @apiName GetRelatedMovies
 * @apiGroup VOD_V3
 *
 * @apiUse header_auth
 *
 * @apiParam {Number} [page] Page (pagination) number. If missing, returns first page
 * @apiParam {String} [show_adult] Flag for adult content. Only if set to true, adult content is included in the response
 * @apiParam {String} [pin_protected] Flag for pin protected content. Only if set to true, pin protected content is included in the response
 *
 *@apiDescription Returns paginated list of related movies (from most related to least). Number of items per page is specified in the company settings (30 by default).
 *
 * Expired and non-available movies are not returned. By default, pin protected or adult movies are not returned, unless specified otherwise.
 *
 * Movie genre, director and cast are used as match criteria. Movies that don't belong to any genre are excluded.
 *
 * Copy paste this auth for testing purposes
 *auth=%7Bapi_version%3D22%2C+appversion%3D1.1.4.2%2C+screensize%3D480x800%2C+appid%3D2%2C+devicebrand%3D+SM-G361F+Build%2FLMY48B%2C+language%3Deng%2C+ntype%3D1%2C+app_name%3DMAGOWARE%2C+device_timezone%3D2%2C+os%3DLinux%3B+U%3B+Android+5.1.1%2C+auth%3D8yDhVenHT3Mp0O2QCLJFhCUfT73WR1mE2QRc1ZE7J22cRfmskdTmhCk9ssGWhoIBpIzoTEOLIqwl%0A47NaUwLoLZjH1i2WRYaiioIRMqhRvH2FsSuf1YG%2FFoT9fEw4CrxF%0A%2C+hdmi%3Dfalse%2C+firmwareversion%3DLMY48B.G361FXXU1APB1%7D
 *
 */
exports.get_related_movies = function (req, res) {

    const page_length = (req.app.locals.backendsettings[req.thisuser.company_id].vod_subset_nr) ? req.app.locals.backendsettings[req.thisuser.company_id].vod_subset_nr : 30; //max nr of movies in the response
    if (!req.query.page) req.query.page = 1; //if page param is missing, set page to 1
    const vodId = parseInt(req.params.vod_id);

    if (!vodId) {
        return response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
    }

    //set range of movies
    const offset = (!req.query.page) ? 0 : (((parseInt(req.query.page) - 1)) * page_length);
    const limit = page_length; //number of records per request

    models.package.findAll({
        attributes: ['id'],
        where: {package_type_id: req.auth_obj.screensize + 2},
        include: [{
            model: models.subscription,
            required: true,
            attributes: ['id'],
            where: {login_id: req.thisuser.id, end_date: {[Op.gte]: Date.now()}}
        }]
    }).then(function (packagesWithSubscription) {
        models.vod.findAll({
            attributes: ['director', 'starring', [sequelize.literal('"film"'), 'vod_type']],
            include: [{
                model: models.vod_vod_categories, attributes: ['category_id'], where: {is_available: true}
            }],
            where: {id: req.params.vod_id, company_id: req.thisuser.company_id},
            limit: 1
        }).then(function (result) {
            if (result && result.length > 0) {
                const director_list = result[0].director.split(',');
                let director_matching_score = "";
                for (let i = 0; i < director_list.length; i++) {
                    if (i === director_list.length - 1) director_matching_score += sqlstring.format(" IF( ( director like '%??%' ), 0.5, 0)", [director_list[i].trim().replace(new RegExp("'", 'g'), " ")]);
                    else director_matching_score += sqlstring.format(" IF( ( director like '%??%' ), 0.5, 0) + ", [director_list[i].trim().replace(new RegExp("'", 'g'), " ")]);
                }

                const actor_list = result[0].starring.split(',');
                let actor_matching_score = "";
                for (let j = 0; j < actor_list.length; j++) {
                    if (j === actor_list.length - 1) actor_matching_score += sqlstring.format("IF( ( starring like '%??%' ), 0.3, 0)", [actor_list[j].trim().replace(new RegExp("'", 'g'), " ")]);
                    else actor_matching_score += sqlstring.format("IF( ( starring like '%??%' ), 0.3, 0) + ", [actor_list[j].trim().replace(new RegExp("'", 'g'), " ")]);
                }

                const genresList = result[0].vod_vod_categories;

                let genresMatchingScore = "";
                for (let k = 0; k < genresList.length; k++) {
                    if (k === genresList.length - 1) genresMatchingScore += sqlstring.format("IF( ( vod_vod_categories.category_id = ? ), 1, 0)", [genresList[k].category_id]);
                    else genresMatchingScore += sqlstring.format("IF( ( vod_vod_categories.category_id = ? ), 1, 0) + ", [genresList[k].category_id])
                }

                let packages = [];
                for (let i = 0; i < packagesWithSubscription.length; i++) {
                    packages.push(packagesWithSubscription[i].id);
                }
                //prepare the where clause
                let where_condition = "";
                where_condition += " vod.id <> " + vodId; //exclude current movie from list
                where_condition += " AND vod.company_id = " + req.thisuser.company_id + " ";
                where_condition += " AND vod.isavailable = true"; //return only available movies
                where_condition += " AND package_vod.package_id IN (" + packages.join() + ")";
                where_condition += " AND expiration_time > NOW() "; //do not return movies that have expired
                if (!req.query.pin_protected || req.query.pin_protected !== 'true') where_condition += " AND pin_protected = false"; //return pin_protected content only if explicitly allowed
                if (!req.query.show_adult || req.query.show_adult !== "true") where_condition += " AND adult_content = false "; //return adult content only if explicitly allowed


                let related_query = "SELECT " +
                    "DISTINCT vod.id, vod.vote_count, vod.vote_average, vod.title, vod.popularity, vod.original_language, vod.original_title, vod.adult_content as adult, vod.description as overview, 'film' as vod_type, " +
                    " vod.trailer_url, concat(" + sqlstring.escape(req.app.locals.backendsettings[req.thisuser.company_id].assets_url) + ", vod.image_url) as backdrop_path," +
                    " concat(" + sqlstring.escape(req.app.locals.backendsettings[req.thisuser.company_id].assets_url) + ", vod.icon_url) as poster_path," +
                    " DATE_FORMAT(vod.release_date, '%Y-%m-%d') as release_date, " +
                    " ( ";
                if (genresMatchingScore && genresMatchingScore !== "")
                    related_query += " ( " + genresMatchingScore + " ) + "; //genres matching score

                if (director_matching_score && director_matching_score !== "")
                    related_query += " ( " + director_matching_score + " ) + "; //director matching score

                if (actor_matching_score && actor_matching_score !== "")
                    related_query += " ( " + actor_matching_score + " ) "; //actor matching score

                related_query += " ) AS matching_score " +
                    " FROM vod " +
                    " INNER JOIN vod_vod_categories ON vod.id = vod_vod_categories.vod_id INNER JOIN vod_category ON vod_vod_categories.category_id = vod_category.id " + //the similarity depends greatly on genre, so genre is required
                    " INNER JOIN package_vod ON vod.id = package_vod.vod_id" + //inner join vod package
                    " WHERE " + where_condition +
                    " GROUP BY vod.id " +
                    " ORDER BY  matching_score DESC " + //order movies from most related to least related
                    " LIMIT " + offset + ", " + limit + " " +
                    ";";

                sequelize_instance.sequelize.query(
                    related_query
                ).then(function (related_result) {
                    if (!related_result || !related_result[0]) {
                        response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'NO DATA FOUND', 'no-store');
                    } else {
                        res.setHeader("X-Total-Count", related_result[0].length);
                        response.send_res_get(req, res, related_result[0], 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'private,max-age=86400');
                    }
                }).catch(function (error) {
                    winston.error("Quering for related items failed with error: ", error);
                    response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
                });
            } else {
                response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'NO DATA FOUND', 'no-store');
            }
            return null;
        }).catch(function (error) {
            winston.error("Finding the movie's attributes failed with error: ", error);
            response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
        });
    }).catch(function (error) {
        winston.error("Finding the movie's attributes failed with error: ", error);
        response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
    });
};

/**
 * @api {get} /apiv3/vod/purchase_list Get Purchased Movies
 * @apiName GetPurchasedMovies
 * @apiGroup VOD_V3
 *
 * @apiUse header_auth
 *
 * @apiParam {String} [is_available] Flag for available movies. Return all purchased movies by default, filter by availability if specified. Value set: ['true', 'false']
 * @apiParam {String} [get_expired_movies] Flag for expired purchases. Return all purchased movies by default, filter by expiration if specified. Value set: ['true', 'false']
 * @apiParam {String} [show_adult] Flag for adult content. Only if set to true, adult content is included in the response.
 * @apiParam {String} [pin_protected] Flag for pin protected content. Only if set to true, pin protected content is included in the response
 *
 *@apiDescription Returns list of purchased movies. By default, the result includes expired and non-available movies. Use the filters for different results.
 *
 * By default, pin protected or adult movies are not returned, unless specified otherwise.
 *
 * Copy paste this auth for testing purposes
 *auth=%7Bapi_version%3D22%2C+appversion%3D1.1.4.2%2C+screensize%3D480x800%2C+appid%3D2%2C+devicebrand%3D+SM-G361F+Build%2FLMY48B%2C+language%3Deng%2C+ntype%3D1%2C+app_name%3DMAGOWARE%2C+device_timezone%3D2%2C+os%3DLinux%3B+U%3B+Android+5.1.1%2C+auth%3D8yDhVenHT3Mp0O2QCLJFhCUfT73WR1mE2QRc1ZE7J22cRfmskdTmhCk9ssGWhoIBpIzoTEOLIqwl%0A47NaUwLoLZjH1i2WRYaiioIRMqhRvH2FsSuf1YG%2FFoT9fEw4CrxF%0A%2C+hdmi%3Dfalse%2C+firmwareversion%3DLMY48B.G361FXXU1APB1%7D
 *
 */
exports.get_purchased_movies = function (req, res) {
    const attribute_list = [
        'vote_count', 'vote_average', 'title', 'popularity', [sequelize.literal('"film"'), 'vod_type'], 'trailer_url',
        [db.sequelize.fn("concat", req.app.locals.backendsettings[req.thisuser.company_id].assets_url, db.sequelize.col('image_url')), 'backdrop_path'],
        [db.sequelize.fn("concat", req.app.locals.backendsettings[req.thisuser.company_id].assets_url, db.sequelize.col('icon_url')), 'poster_path'],
        'original_language', 'original_title', ['adult_content', 'adult'], ['description', 'overview'], [sequelize.fn('DATE_FORMAT', sequelize.col('release_date'), '%Y-%m-%d'), 'release_date']
    ];

    let where_condition = {login_data_id: req.thisuser.id}; //get movies purchased by this client
    if (req.query.get_expired_movies === 'true') where_condition.end_time = {[Op.lte]: Date.now()}; //return only expired purchases
    if (req.query.get_expired_movies === 'false') where_condition.end_time = {[Op.gte]: Date.now()}; //return only active purchases

    let movie_condition = {};
    movie_condition.isavailable = (!req.query.is_available) ? {[Op.in]: [true, false]} : (req.query.is_available === 'true'); //return all purchased movies, unless specified otherwise by parameter is_available
    where_condition.company_id = req.thisuser.company_id;
    movie_condition.pin_protected = (req.query.pin_protected === 'true') ? {[Op.in]: [true, false]} : false; //pin protected content returned only if request explicitly asks for it
    movie_condition.adult_content = (req.query.show_adult === 'true') ? {[Op.in]: [true, false]} : false; //adult content returned only if request explicitly asks for it

    models.vod.findAll({
        attributes: attribute_list,
        where: movie_condition,
        include: [{model: models.t_vod_sales, attributes: [], where: where_condition}]
    }).then(function (purchase_list) {
        response.send_res_get(req, res, purchase_list, 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'private,max-age=86400');
    }).catch(function (error) {
        winston.error("Getting list of purchased movies failed with error: ", error);
        response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
    });

};


/**
 * @api {get} /apiv3/vod/paused_movies Get VOD Paused List
 * @apiName GetVodPausedList
 * @apiGroup VOD_V3
 * @apiParam (Query parameters) {String} user_id User ID as query parameter
 * @apiUse header_auth
 *@apiDescription Returns paginated list of paused movies < 90%.
 *
 * Expired and non-available movies are not returned. By default, pin protected or adult movies are not returned, unless specified otherwise.
 *
 * Copy paste this auth for testing purposes
 *auth=%7Bapi_version%3D22%2C+appversion%3D1.1.4.2%2C+screensize%3D480x800%2C+appid%3D2%2C+devicebrand%3D+SM-G361F+Build%2FLMY48B%2C+language%3Deng%2C+ntype%3D1%2C+app_name%3DMAGOWARE%2C+device_timezone%3D2%2C+os%3DLinux%3B+U%3B+Android+5.1.1%2C+auth%3D8yDhVenHT3Mp0O2QCLJFhCUfT73WR1mE2QRc1ZE7J22cRfmskdTmhCk9ssGWhoIBpIzoTEOLIqwl%0A47NaUwLoLZjH1i2WRYaiioIRMqhRvH2FsSuf1YG%2FFoT9fEw4CrxF%0A%2C+hdmi%3Dfalse%2C+firmwareversion%3DLMY48B.G361FXXU1APB1%7D
 *
 */

exports.get_paused_movies = function (req, res) {

    var user_id = req.thisuser.id;
    const page_length = (req.app.locals.backendsettings[req.thisuser.company_id].vod_subset_nr) ? req.app.locals.backendsettings[req.thisuser.company_id].vod_subset_nr : 30; //max nr of movies in the response
    if (!req.query.page) req.query.page = 1;
    let final_where = {};
    final_where.where = {};

    //set range of movies
    final_where.offset = (!req.query.page) ? 0 : (((parseInt(req.query.page) - 1)) * page_length);
    final_where.limit = page_length;

    //attribute list
    final_where.attributes = [
        'id', 'vote_count', 'vote_average', 'title', 'popularity', [sequelize.literal('"film"'), 'vod_type'], 'trailer_url', 'price', 'expiration_time',
        [db.sequelize.fn("concat", req.app.locals.backendsettings[req.thisuser.company_id].assets_url, db.sequelize.col('image_url')), 'backdrop_path'],
        [db.sequelize.fn("concat", req.app.locals.backendsettings[req.thisuser.company_id].assets_url, db.sequelize.col('vod.icon_url')), 'poster_path'],
        'original_language', 'original_title', ['adult_content', 'adult'], ['description', 'overview'], [sequelize.fn('DATE_FORMAT', sequelize.col('release_date'), '%Y-%m-%d'), 'release_date']
    ];

    final_where.group = "vod.id";

    //prepare search condition by keyword
    if (req.query.search) {
        const like = {[Op.like]: sqlstring.format("?", ["%" + req.query.search.trim() + "%"]).replace(new RegExp("'", 'g'), "")};
        final_where.where = Object.assign(final_where.where, {
            [Op.or]: {
                title: like,
                original_title: like,
                description: like
            }
        })
    }

    //filter list
    final_where.where.isavailable = true; //return only available movies
    final_where.where.company_id = req.thisuser.company_id;
    final_where.where.expiration_time = {[Op.gte]: Date.now()};
    final_where.where.pin_protected = (req.query.pin_protected === 'true') ? {[Op.in]: [true, false]} : false; //pin protected content returned only if request explicitly asks for it
    final_where.where.adult_content = (req.query.show_adult === 'true') ? {[Op.in]: [true, false]} : false; //adult content returned only if request explicitly asks for it

    //prepare order clause
    const order_by = (req.query.order_by) ? req.query.order_by : 'createdAt';
    const order_dir = (req.query.order_dir) ? req.query.order_dir : 'DESC';
    final_where.order = [[order_by, order_dir]];

    const vod_vod_category_filter = (req.query.category_id) ? {category_id: Number(req.query.category_id)} : {vod_id: {[Op.gt]: 0}}; //if specified, filter by category id
    const vod_category_filter = {password: req.query.pin_protected === 'true' ? {[Op.in]: [true, false]} : false};  //show vods of categories with password only if requested.

    final_where.subQuery = false;

    models.package.findAll({
        attributes: ['id'],
        where: {package_type_id: req.auth_obj.screensize + 2},
        include: [{
            model: models.subscription,
            required: true,
            attributes: ['id'],
            where: {login_id: user_id, end_date: {[Op.gte]: Date.now()}}
        }]
    }).then(function (packages) {
        let package_list = [];
        for (let i = 0; i < packages.length; i++) {
            package_list.push(packages[i].id);
        }
        //join tables
        final_where.include = [
            {
                model: models.vod_vod_categories, required: true, attributes: [], where: vod_vod_category_filter,
                include: [{model: models.vod_category, attributes: [], where: vod_category_filter}]
            },
            {model: models.package_vod, required: true, attributes: [], where: {package_id: {[Op.in]: package_list}}},
            {
                model: models.vod_resume,
                required: true,
                attributes: ['login_id', 'favorite', 'percentage_position'],
                where: {login_id: user_id, percentage_position: {[Op.lt]: 90} && {[Op.gt]: 0}}
            }
        ];
        //search for vod
        models.vod.findAndCountAll(
            final_where
        ).then(function (results) {
            const vod_list = {
                page: Number(req.query.page), //page number
                total_results: results.count.length, //number of vod items in total for this user. This is a maximum bound, not the exact number
                total_pages: Math.ceil(results.count.length / page_length), //number of pages for this user. This is a maximum bound, not the exact number
                results: results.rows //return found records
            };
            res.setHeader("X-Total-Count", results.count.length);
            response.send_res_get(req, res, vod_list, 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'private,max-age=86400');
        }).catch(function (error) {
            winston.error("Getting the movie list failed with error: ", error);
            response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
        });
        return null;
    }).catch(function (error) {
        winston.error("Getting the vod package list failed with error: ", error);
        response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
    });
}


/**
 * @api {get} /apiv3/vod/favorite_movies Get Vod Favorite List
 * @apiName GetVodFavoriteList
 * @apiGroup VOD_V3
 * @apiParam (Query parameters) {String} user_id User ID as query parameter
 *
 * @apiUse header_auth
 *@apiDescription Returns paginated list of favorites movies.
 *
 * Expired and non-available movies are not returned. By default, pin protected or adult movies are not returned, unless specified otherwise.
 *
 * Copy paste this auth for testing purposes
 *auth=%7Bapi_version%3D22%2C+appversion%3D1.1.4.2%2C+screensize%3D480x800%2C+appid%3D2%2C+devicebrand%3D+SM-G361F+Build%2FLMY48B%2C+language%3Deng%2C+ntype%3D1%2C+app_name%3DMAGOWARE%2C+device_timezone%3D2%2C+os%3DLinux%3B+U%3B+Android+5.1.1%2C+auth%3D8yDhVenHT3Mp0O2QCLJFhCUfT73WR1mE2QRc1ZE7J22cRfmskdTmhCk9ssGWhoIBpIzoTEOLIqwl%0A47NaUwLoLZjH1i2WRYaiioIRMqhRvH2FsSuf1YG%2FFoT9fEw4CrxF%0A%2C+hdmi%3Dfalse%2C+firmwareversion%3DLMY48B.G361FXXU1APB1%7D
 *
 */

exports.get_favorite_movies = function (req, res) {

    var user_id = req.thisuser.id;

    const page_length = (req.app.locals.backendsettings[req.thisuser.company_id].vod_subset_nr) ? req.app.locals.backendsettings[req.thisuser.company_id].vod_subset_nr : 30; //max nr of movies in the response
    if (!req.query.page) req.query.page = 1;
    let final_where = {};
    final_where.where = {};

    //set range of movies
    final_where.offset = (!req.query.page) ? 0 : (((parseInt(req.query.page) - 1)) * page_length);
    final_where.limit = page_length;

    //attribute list
    final_where.attributes = [
        'id', 'vote_count', 'vote_average', 'title', 'popularity', [sequelize.literal('"film"'), 'vod_type'], 'trailer_url', 'price', 'expiration_time',
        [db.sequelize.fn("concat", req.app.locals.backendsettings[req.thisuser.company_id].assets_url, db.sequelize.col('image_url')), 'backdrop_path'],
        [db.sequelize.fn("concat", req.app.locals.backendsettings[req.thisuser.company_id].assets_url, db.sequelize.col('vod.icon_url')), 'poster_path'],
        'original_language', 'original_title', ['adult_content', 'adult'], ['description', 'overview'], [sequelize.fn('DATE_FORMAT', sequelize.col('release_date'), '%Y-%m-%d'), 'release_date']
    ];

    final_where.group = "vod.id";

    //prepare search condition by keyword
    if (req.query.search) {
        const like = { [Op.like]: sqlstring.format("?", ["%" + req.query.search.trim() + "%"]).replace(new RegExp("'", 'g'), "") };
        final_where.where = Object.assign(final_where.where, {
            [Op.or]: {
                title: like,
                original_title: like,
                description: like
            }
        })
    }

    //filter list
    final_where.where.isavailable = true; //return only available movies
    final_where.where.company_id = req.thisuser.company_id;
    final_where.where.expiration_time = {[Op.gte]: Date.now()};
    final_where.where.pin_protected = (req.query.pin_protected === 'true') ? {[Op.in]: [true, false]} : false; //pin protected content returned only if request explicitly asks for it
    final_where.where.adult_content = (req.query.show_adult === 'true') ? {[Op.in]: [true, false]} : false; //adult content returned only if request explicitly asks for it

    //prepare order clause

    final_where.order = [[[{model: models.vod_resume}, 'updatedAt', 'DESC']]];

    const vod_vod_category_filter = (req.query.category_id) ? {category_id: Number(req.query.category_id)} : {vod_id: {[Op.gt]: 0}}; //if specified, filter by category id
    const vod_category_filter = {password: req.query.pin_protected === 'true' ? {[Op.in]: [true, false]} : false};  //show vods of categories with password only if requested.

    final_where.subQuery = false;

    models.package.findAll({
        attributes: ['id'],
        where: {package_type_id: req.auth_obj.screensize + 2},
        include: [{
            model: models.subscription,
            required: true,
            attributes: ['id'],
            where: {login_id: user_id, end_date: {[Op.gte]: Date.now()}}
        }]
    }).then(function (packages) {
        let package_list = [];
        for (let i = 0; i < packages.length; i++) {
            package_list.push(packages[i].id);
        }
        //join tables
        final_where.include = [
            {
                model: models.vod_vod_categories, required: true, attributes: [], where: vod_vod_category_filter,
                include: [{model: models.vod_category, attributes: [], where: vod_category_filter}]
            },
            {model: models.package_vod, required: true, attributes: [], where: {package_id: {[Op.in]: package_list}}},
            {
                model: models.vod_resume,
                required: true,
                attributes: ['login_id', 'favorite', 'reaction'],
                where: {favorite: 1, login_id: user_id}
            }
        ];
        //search for vod
        models.vod.findAndCountAll(
            final_where
        ).then(function (results) {
            const vod_list = {
                page: Number(req.query.page), //page number
                total_results: results.count.length, //number of vod items in total for this user. This is a maximum bound, not the exact number
                total_pages: Math.ceil(results.count.length / page_length), //number of pages for this user. This is a maximum bound, not the exact number
                results: results.rows //return found records
            };
            res.setHeader("X-Total-Count", results.count.length);
            response.send_res_get(req, res, vod_list, 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'no-store');
        }).catch(function (error) {
            winston.error("Getting the movie list failed with error: ", error);
            response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
        });
        return null;
    }).catch(function (error) {
        winston.error("Getting the vod package list failed with error: ", error);
        response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
    });
}

/**
 * @api {get} /apiv3/vod/navigated_movies Get VOD Navigated List
 * @apiName GetVodNavigatedList
 * @apiGroup VOD_V3
 * @apiParam (Query parameters) {String} user_id User ID as query parameter
 * @apiUse header_auth
 *@apiDescription Returns paginated list of navigated movies based on seen_details time.
 *
 * Expired and non-available movies are not returned. By default, pin protected or adult movies are not returned, unless specified otherwise.
 *
 * Copy paste this auth for testing purposes
 *auth=%7Bapi_version%3D22%2C+appversion%3D1.1.4.2%2C+screensize%3D480x800%2C+appid%3D2%2C+devicebrand%3D+SM-G361F+Build%2FLMY48B%2C+language%3Deng%2C+ntype%3D1%2C+app_name%3DMAGOWARE%2C+device_timezone%3D2%2C+os%3DLinux%3B+U%3B+Android+5.1.1%2C+auth%3D8yDhVenHT3Mp0O2QCLJFhCUfT73WR1mE2QRc1ZE7J22cRfmskdTmhCk9ssGWhoIBpIzoTEOLIqwl%0A47NaUwLoLZjH1i2WRYaiioIRMqhRvH2FsSuf1YG%2FFoT9fEw4CrxF%0A%2C+hdmi%3Dfalse%2C+firmwareversion%3DLMY48B.G361FXXU1APB1%7D
 *
 */

exports.get_navigated_movies = function (req, res) {

    var user_id = req.thisuser.id;

    const page_length = (req.app.locals.backendsettings[req.thisuser.company_id].vod_subset_nr) ? req.app.locals.backendsettings[req.thisuser.company_id].vod_subset_nr : 30; //max nr of movies in the response
    if (!req.query.page) req.query.page = 1;
    let final_where = {};
    final_where.where = {};

    //set range of movies
    final_where.offset = (!req.query.page) ? 0 : (((parseInt(req.query.page) - 1)) * page_length);
    final_where.limit = page_length;

    //attribute list
    final_where.attributes = [
        'id', 'vote_count', 'vote_average', 'title', 'popularity', [sequelize.literal('"film"'), 'vod_type'], 'trailer_url', 'price', 'expiration_time',
        [db.sequelize.fn("concat", req.app.locals.backendsettings[req.thisuser.company_id].assets_url, db.sequelize.col('image_url')), 'backdrop_path'],
        [db.sequelize.fn("concat", req.app.locals.backendsettings[req.thisuser.company_id].assets_url, db.sequelize.col('vod.icon_url')), 'poster_path'],
        'original_language', 'original_title', ['adult_content', 'adult'], ['description', 'overview'], [sequelize.fn('DATE_FORMAT', sequelize.col('release_date'), '%Y-%m-%d'), 'release_date']
    ];

    final_where.group = "vod.id";

    //prepare search condition by keyword
    if (req.query.search) {
        const like = {[Op.like]: sqlstring.format("?", ["%" + req.query.search.trim() + "%"]).replace(new RegExp("'", 'g'), "")};
        final_where.where = Object.assign(final_where.where, {
            [Op.or]: {
                title: like,
                original_title: like,
                description: like
            }
        })
    }

    //filter list
    final_where.where.isavailable = true; //return only available movies
    final_where.where.company_id = req.thisuser.company_id;
    final_where.where.expiration_time = {[Op.gte]: Date.now()};
    final_where.where.pin_protected = (req.query.pin_protected === 'true') ? {[Op.in]: [true, false]} : false; //pin protected content returned only if request explicitly asks for it
    final_where.where.adult_content = (req.query.show_adult === 'true') ? {[Op.in]: [true, false]} : false; //adult content returned only if request explicitly asks for it

    //prepare order clause


    const vod_vod_category_filter = (req.query.category_id) ? {category_id: Number(req.query.category_id)} : {vod_id: {[Op.gt]: 0}}; //if specified, filter by category id
    const vod_category_filter = {password: req.query.pin_protected === 'true' ? {[Op.in]: [true, false]} : false};  //show vods of categories with password only if requested.

    final_where.subQuery = false;

    models.package.findAll({
        attributes: ['id'],
        where: {package_type_id: req.auth_obj.screensize + 2},
        include: [{
            model: models.subscription,
            required: true,
            attributes: ['id'],
            where: {login_id: user_id, end_date: {[Op.gte]: Date.now()}}
        }]
    }).then(function (packages) {
        let package_list = [];
        for (let i = 0; i < packages.length; i++) {
            package_list.push(packages[i].id);
        }
        //join tables
        final_where.include = [
            {
                model: models.vod_vod_categories, required: true, attributes: [], where: vod_vod_category_filter,
                include: [{model: models.vod_category, attributes: [], where: vod_category_filter}]
            },
            {
                model: models.package_vod,
                rorder_byequired: true,
                attributes: [],
                where: {package_id: {[Op.in]: package_list}}
            },
            {
                model: models.vod_resume,
                required: true,
                attributes: ['login_id', 'updatedAt', 'vod_id'],
                where: {login_id: user_id, reaction: {[Op.notIn]: [-1]}}
            },
        ]
        final_where.order = [[[{model: models.vod_resume}, 'updatedAt', 'DESC']]];

        //search for vod
        models.vod.findAndCountAll(
            final_where
        ).then(function (results) {
            const vod_list = {
                page: Number(req.query.page), //page number
                total_results: results.count.length, //number of vod items in total for this user. This is a maximum bound, not the exact number
                total_pages: Math.ceil(results.count.length / page_length), //number of pages for this user. This is a maximum bound, not the exact number
                results: results.rows //return found records
            };
            res.setHeader("X-Total-Count", results.count.length);
            response.send_res_get(req, res, vod_list, 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'private,max-age=86400');
        }).catch(function (error) {
            winston.error("Getting the movie list failed with error: ", error);
            response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
        });
        return null;
    }).catch(function (error) {
        winston.error("Getting the vod package list failed with error: ", error);
        response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
    });
}


/**
 * @api {get} /apiv3/vod/added_movies Get VOD Added List
 * @apiName GetVodLastAddedList
 * @apiGroup VOD_V3
 *
 * @apiUse header_auth
 *@apiDescription Returns paginated list of last movies added based on createAt time.
 *
 * Expired and non-available movies are not returned. By default, pin protected or adult movies are not returned, unless specified otherwise.
 *
 * Copy paste this auth for testing purposes
 *auth=%7Bapi_version%3D22%2C+appversion%3D1.1.4.2%2C+screensize%3D480x800%2C+appid%3D2%2C+devicebrand%3D+SM-G361F+Build%2FLMY48B%2C+language%3Deng%2C+ntype%3D1%2C+app_name%3DMAGOWARE%2C+device_timezone%3D2%2C+os%3DLinux%3B+U%3B+Android+5.1.1%2C+auth%3D8yDhVenHT3Mp0O2QCLJFhCUfT73WR1mE2QRc1ZE7J22cRfmskdTmhCk9ssGWhoIBpIzoTEOLIqwl%0A47NaUwLoLZjH1i2WRYaiioIRMqhRvH2FsSuf1YG%2FFoT9fEw4CrxF%0A%2C+hdmi%3Dfalse%2C+firmwareversion%3DLMY48B.G361FXXU1APB1%7D
 *
 */

exports.get_added_movies = function (req, res) {

    const page_length = (req.app.locals.backendsettings[req.thisuser.company_id].vod_subset_nr) ? req.app.locals.backendsettings[req.thisuser.company_id].vod_subset_nr : 30; //max nr of movies in the response
    if (!req.query.page) req.query.page = 1;
    let final_where = {};
    final_where.where = {};

    //set range of movies
    final_where.offset = (!req.query.page) ? 0 : (((parseInt(req.query.page) - 1)) * page_length);
    final_where.limit = page_length;

    //attribute list
    final_where.attributes = [
        'id', 'vote_count', 'vote_average', 'title', 'popularity', [sequelize.literal('"film"'), 'vod_type'], 'trailer_url', 'price', 'expiration_time',
        [db.sequelize.fn("concat", req.app.locals.backendsettings[req.thisuser.company_id].assets_url, db.sequelize.col('image_url')), 'backdrop_path'],
        [db.sequelize.fn("concat", req.app.locals.backendsettings[req.thisuser.company_id].assets_url, db.sequelize.col('vod.icon_url')), 'poster_path'],
        'original_language', 'original_title', ['adult_content', 'adult'], ['description', 'overview'], [sequelize.fn('DATE_FORMAT', sequelize.col('release_date'), '%Y-%m-%d'), 'release_date']
    ];

    final_where.group = "vod.id";

    //prepare search condition by keyword
    if (req.query.search) {
        const like = {[Op.like]: sqlstring.format("?", ["%" + req.query.search.trim() + "%"]).replace(new RegExp("'", 'g'), "")};
        final_where.where = Object.assign(final_where.where, {
            [Op.or]: {
                title: like,
                original_title: like,
                description: like
            }
        })
    }

    //filter list
    final_where.where.isavailable = true; //return only available movies
    final_where.where.company_id = req.thisuser.company_id;
    final_where.where.expiration_time = {[Op.gte]: Date.now()};
    final_where.where.pin_protected = (req.query.pin_protected === 'true') ? {[Op.in]: [true, false]} : false; //pin protected content returned only if request explicitly asks for it
    final_where.where.adult_content = (req.query.show_adult === 'true') ? {[Op.in]: [true, false]} : false; //adult content returned only if request explicitly asks for it

    const order_by = (req.query.order_by) ? req.query.order_by : 'release_date';
    const order_dir = (req.query.order_dir) ? req.query.order_dir : 'DESC';
    final_where.order = [[order_by, order_dir]];

    final_where.subQuery = false;

    models.vod.findAndCountAll(
        final_where
    ).then(function (results) {
        const vod_list = {
            page: Number(req.query.page), //page number
            total_results: results.count.length, //number of vod items in total for this user. This is a maximum bound, not the exact number
            total_pages: Math.ceil(results.count.length / page_length), //number of pages for this user. This is a maximum bound, not the exact number
            results: results.rows //return found records
        };
        res.setHeader("X-Total-Count", results.count.length);
        response.send_res_get(req, res, vod_list, 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'private,max-age=86400');
    }).catch(function (error) {
        winston.error("Getting the movie list failed with error: ", error);
        response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
    });
}


/**
 * @api {get} /apiv3/vod/tvod_movies Get TV VOD Movies
 * @apiName GetTVODMovies
 * @apiGroup VOD_V3
 *
 * @apiUse header_auth
 *
 * @apiParam {Number} [page] Page (pagination) number. If missing, returns first page
 * @apiParam {String} [show_adult] Flag for adult content. If set to true, adult content is included in the response. Value set: ['true']
 * @apiParam {String} [pin_protected] Flag for pin protected content. If set to true, pin protected content is included in the response. Value set: ['true']
 *
 *@apiDescription List of movies that the clients can purchase individually. Only possible if the combo for transactional vod is active.
 *
 * Films that expire before the end of the transactional vod duration are excluded. The sale duration is specified in the advanced settings.
 *
 * Non-available movies are excluded. Movies that are not available for sale (price = 0) are excluded.
 *
 * By default, pin protected or adult movies are not returned, unless specified otherwise.
 *
 * Copy paste this auth for testing purposes
 *auth=%7Bapi_version%3D22%2C+appversion%3D1.1.4.2%2C+screensize%3D480x800%2C+appid%3D2%2C+devicebrand%3D+SM-G361F+Build%2FLMY48B%2C+language%3Deng%2C+ntype%3D1%2C+app_name%3DMAGOWARE%2C+device_timezone%3D2%2C+os%3DLinux%3B+U%3B+Android+5.1.1%2C+auth%3D8yDhVenHT3Mp0O2QCLJFhCUfT73WR1mE2QRc1ZE7J22cRfmskdTmhCk9ssGWhoIBpIzoTEOLIqwl%0A47NaUwLoLZjH1i2WRYaiioIRMqhRvH2FsSuf1YG%2FFoT9fEw4CrxF%0A%2C+hdmi%3Dfalse%2C+firmwareversion%3DLMY48B.G361FXXU1APB1%7D
 *
 */
exports.get_tvod_movies = function (req, res) {

    //find duration for vod sale, from special combo with identifier transactional_vod
    if (typeof req.app.locals.backendsettings[req.thisuser.company_id].t_vod_duration !== "number") {
        response.send_res_get(req, res, [], 200, 1, 'NOT_FOUND_DESCRIPTION', 'NO_DATA_FOUND', 'private,max-age=86400'); //transactional vod is not enabled, return empty list
    } else {
        const sale_duration = req.app.locals.backendsettings[req.thisuser.company_id].t_vod_duration;
        const page_length = (req.app.locals.backendsettings[req.thisuser.company_id].vod_subset_nr) ? req.app.locals.backendsettings[req.thisuser.company_id].vod_subset_nr : 30; //max nr of movies in the response
        const attribute_list = [
            'vote_count', 'vote_average', 'title', 'popularity', [sequelize.literal('"film"'), 'vod_type'], 'trailer_url',
            [db.sequelize.fn("concat", req.app.locals.backendsettings[req.thisuser.company_id].assets_url, db.sequelize.col('image_url')), 'backdrop_path'],
            [db.sequelize.fn("concat", req.app.locals.backendsettings[req.thisuser.company_id].assets_url, db.sequelize.col('icon_url')), 'poster_path'],
            'original_language', 'original_title', ['adult_content', 'adult'], ['description', 'overview'], [sequelize.fn('DATE_FORMAT', sequelize.col('release_date'), '%Y-%m-%d'), 'release_date']
        ];

        const tvod_where = {
            isavailable: true, //only return available movies
            price: {[Op.gt]: 0}, //movies with price greater that 0 are available for sale
            expiration_time: {[Op.gte]: db.sequelize.fn('DATE_ADD', db.sequelize.literal('NOW()'), db.sequelize.literal('INTERVAL ' + sale_duration + ' DAY'))}, //make sure the sale duration is longer than the movie's expiration
            adult_content: (req.query.show_adult === 'true') ? {[Op.in]: [true, false]} : false, //adult content returned only if request explicitly asks for it
            pin_protected: (req.query.pin_protected === 'true') ? {[Op.in]: [true, false]} : false, //pin protected content returned only if request explicitly asks for it
            company_id: req.thisuser.company_id
        };

        //set range of movies
        const offset = (!req.query.page) ? 0 : (((parseInt(req.query.page) - 1)) * page_length);
        const limit = page_length;

        models.vod.findAll({
            attributes: attribute_list,
            where: tvod_where,
            offset: offset, limit: limit
        }).then(function (tvod_movies) {
            response.send_res_get(req, res, tvod_movies, 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'private,max-age=86400');
        }).catch(function (error) {
            winston.error("Getting list of movies available for sale failed with error: ", error);
            response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
        });
    }

};