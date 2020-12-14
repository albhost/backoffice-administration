'use strict';
const path = require('path'),
    db = require(path.resolve('./config/lib/sequelize')),
    models = db.models,
    sequelize = require('sequelize'),
    sequelize_instance = require(path.resolve('./config/lib/sequelize')),
    async = require('async'),
    response = require(path.resolve("./config/responses.js")),
    winston = require(path.resolve('./config/lib/winston')),
    moment = require('moment'),
    sqlstring = require('sqlstring');
const axios = require('axios');
const  { Op } = require('sequelize');

async function getTvShowTMDbId(title) {
    try {
        let gettmdbid = await axios.get('https://api.themoviedb.org/3/search/tv', {
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
 * @api {get} /apiv3/tv_show/tv_show_list Get TV Show List
 * @apiName GetTvShowList
 * @apiGroup TV SHOWS
 *
 * @apiUse header_auth
 *
 * @apiParam {Number} [page] Page (pagination) number. If missing, returns first page
 * @apiParam {String} [search]  Partial search string. Searches in following fields: title, original_title, description, tagline
 * @apiParam {String} [pin_protected]  Flag for pin protected content. Only if set to true, pin protected content is included in the response
 * @apiParam {String} [show_adult]  Flag for adult content. Only if set to true, adult content is included in the response
 * @apiParam {Number} [category_id] Filter tv shows by category id
 * @apiParam {String} [order_by] Orders items by a specified field. Creation date is the default. Value set is [clicks, rate, vote_average, vote_count, popularity,  pin_protected, adult_content, isavailable, expiration_time, price, revenue, budget, release_date]
 * @apiParam {String} [order_dir] Order direction. Descending is default. Value set is [desc, asc]
 *
 *@apiDescription
 *
 * Non-available and expired tv shows are excluded. By default, pin protected or adult movies are not returned, unless specified otherwise.
 *
 * Copy paste this auth for testing purposes
 *auth=%7Bapi_version%3D22%2C+appversion%3D1.1.4.2%2C+screensize%3D480x800%2C+appid%3D2%2C+devicebrand%3D+SM-G361F+Build%2FLMY48B%2C+language%3Deng%2C+ntype%3D1%2C+app_name%3DMAGOWARE%2C+device_timezone%3D2%2C+os%3DLinux%3B+U%3B+Android+5.1.1%2C+auth%3D8yDhVenHT3Mp0O2QCLJFhCUfT73WR1mE2QRc1ZE7J22cRfmskdTmhCk9ssGWhoIBpIzoTEOLIqwl%0A47NaUwLoLZjH1i2WRYaiioIRMqhRvH2FsSuf1YG%2FFoT9fEw4CrxF%0A%2C+hdmi%3Dfalse%2C+firmwareversion%3DLMY48B.G361FXXU1APB1%7D
 *
 */
exports.tv_show_list = function (req, res) {

    const page_length = (req.app.locals.backendsettings[req.thisuser.company_id].vod_subset_nr) ? req.app.locals.backendsettings[req.thisuser.company_id].vod_subset_nr : 30; //max nr of movies in the response
    if (!req.query.page) req.query.page = 1; //if page param is missing, set page to 1
    const final_where = {};
    final_where.where = {};

    //set range of movies
    final_where.offset = (!req.query.page) ? 0 : (((parseInt(req.query.page) - 1)) * page_length);
    final_where.limit = page_length;

    //attribute list
    final_where.attributes = [
        'id', 'vote_count', 'vote_average', 'title', 'popularity', [sequelize.literal('"tv_series"'), 'vod_type'], 'trailer_url', 'createdAt', 'price', 'expiration_time',
        [db.sequelize.fn("concat", req.app.locals.backendsettings[req.thisuser.company_id].assets_url, db.sequelize.col('tv_series.image_url')), 'backdrop_path'],
        [db.sequelize.fn("concat", req.app.locals.backendsettings[req.thisuser.company_id].assets_url, db.sequelize.col('tv_series.icon_url')), 'poster_path'],
        'original_language', 'original_title', ['adult_content', 'adult'], ['description', 'overview'], [sequelize.fn('DATE_FORMAT', sequelize.col('tv_series.release_date'), '%Y-%m-%d'), 'release_date']
    ];

    if (req.query.search) {
        const q = decodeURIComponent(req.query.search);
        const like = {[Op.like]: sqlstring.format("?", ["%" + q.trim() + "%"]).replace(new RegExp("'", 'g'), "")};
        final_where.where = {
            [Op.or]: {
                title: like,
                original_title: like,
                description: like
            }
        }
    }

    //filter list
    final_where.where.company_id = req.thisuser.company_id;
    final_where.where.is_available = true; //return only available tv series
    final_where.where.expiration_time = {[Op.gte]: Date.now()}; //exclude tv series that have not expired yet
    final_where.where.pin_protected = (req.query.pin_protected === 'true') ? {[Op.in]: [true, false]} : false; //pin protected content returned only if request explicitly asks for it
    final_where.where.adult_content = (req.query.show_adult === 'true') ? {[Op.in]: [true, false]} : false; //adult content returned only if request explicitly asks for it

    //prepare order clause
    const order_by = (req.query.order_by) ? req.query.order_by : 'createdAt';
    const order_dir = (req.query.order_dir) ? req.query.order_dir : 'DESC';
    final_where.order = [[order_by, order_dir]];
    final_where.distinct = true; //ensures that the count does not include join results

    const category_filter = (req.query.category_id) ? {category_id: Number(req.query.category_id)} : {tv_show_id: {[Op.gt]: 0}}; //if specified, filter by category id

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
        var package_list = [];
        for (var i = 0; i < packages.length; i++) {
            package_list.push(packages[i].id);
        }

        //join tables
        final_where.include = [
            {model: models.tv_series_categories, required: true, attributes: [], where: category_filter},
            {model: models.t_tv_series_sales, required: false, attributes: ['id'], where: {end_time: {[Op.gte]: Date.now()}}},
            {
                model: models.tv_season,
                attributes: ['id', 'season_number', 'title'],
                required: false,
                where: {expiration_time: {[Op.gte]: Date.now()}, is_available: true}
            },
            {
                model: models.tv_season,
                as: 'season',
                attributes: ['id', 'season_number', 'title'],
                required: false,
                where: {expiration_time: {[Op.gte]: Date.now()}, is_available: true},
                include: [{
                    model: models.tv_episode,
                    attributes: ['id', 'tv_season_id', 'season_number', 'episode_number'],
                    required: false,
                    where: {expiration_time: {[Op.gte]: Date.now()}, is_available: true},
                    include: [{
                        model: models.tv_episode_resume,
                        required: false,
                        where: {login_id: req.thisuser.id},
                        attributes: ['updatedAt']
                    }]
                }]
            },
            {model: models.tv_series_packages, required: false, attributes: ['id'], where: {package_id: {[Op.in]: package_list}}}
        ];

        //start query
        models.tv_series.findAndCountAll(
            final_where
        ).then(function (results) {
            let tv_show_list = [];
            const transactional_vod_duration = req.app.locals.backendsettings[req.thisuser.company_id].t_vod_duration;
            async.forEach(results.rows, function (tv_show, callback) {
                tv_show = tv_show.toJSON();

                const subscription_list = !!(tv_show.tv_series_packages && tv_show.tv_series_packages.length > 0);
                const purchased = !!(tv_show.t_tv_series_sales && tv_show.t_tv_series_sales.length > 0);
                const available_for_purchase = !!(tv_show.price > 0 && transactional_vod_duration && (moment(tv_show.expiration_time) > moment().add(transactional_vod_duration, 'day')));

                if (subscription_list || purchased || available_for_purchase) {
                    //find last watched episode
                    tv_show.last_watched = {};
                    let last_watched_date = null;
                    for (let i = 0; i < tv_show.season.length; i++) {
                        for (let j = 0; j < tv_show.season[i].tv_episodes.length; j++) {
                            if (tv_show.season[i].tv_episodes[j].tv_episode_resumes[0] && last_watched_date < tv_show.season[i].tv_episodes[j].tv_episode_resumes[0].updatedAt) {
                                last_watched_date = tv_show.season[i].tv_episodes[j].tv_episode_resumes[0].updatedAt;
                                tv_show.last_watched = {
                                    "episode_id": tv_show.season[i].tv_episodes[j].id,
                                    "season_id": tv_show.season[i].tv_episodes[j].tv_season_id,
                                    "season_number": tv_show.season[i].tv_episodes[j].season_number,
                                    "episode_number": tv_show.season[i].tv_episodes[j].episode_number
                                };
                            }
                        }
                    }

                    //delete data not needed by the application
                    delete tv_show.season;
                    delete tv_show.createdAt;
                    delete tv_show.t_tv_series_sales;
                    delete tv_show.tv_series_packages;

                    tv_show_list.push(tv_show); //load the tv show object in the response data
                    callback(null);
                } else callback(null);
            }, function (error, result) {
                const vod_list = {
                    "page": Number(req.query.page), //page number
                    "total_results": results.count, //number of vod items in total for this user
                    "total_pages": Math.ceil(results.count / page_length), //number of pages for this user
                    "results": tv_show_list //return found records
                };
                res.setHeader("X-Total-Count", results.count);
                response.send_res_get(req, res, vod_list, 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'private,max-age=86400');
            });
        }).catch(function (error) {
            winston.error("Getting the tv show list failed with error: ", error);
            response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
        });

        return null;
    }).catch(function (error) {
        winston.error("Getting the vod package list failed with error: ", error);
        response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
    });

};



/**
 * @api {get} /apiv3/tv_show/favorite_tv_shows Get TV Show Favorite List
 * @apiName GetTvShowList
 * @apiGroup TV SHOWS
 *
 * @apiParam (Query parameters) {String} user_id User ID as query parameter
 *
 * @apiUse header_auth
 *@apiDescription Returns paginated list of favorites tv_shows.
 *
 * Expired and non-available tv_shows are not returned. By default, pin protected or adult movies are not returned, unless specified otherwise.
 *
 * Copy paste this auth for testing purposes
 *auth=%7Bapi_version%3D22%2C+appversion%3D1.1.4.2%2C+screensize%3D480x800%2C+appid%3D2%2C+devicebrand%3D+SM-G361F+Build%2FLMY48B%2C+language%3Deng%2C+ntype%3D1%2C+app_name%3DMAGOWARE%2C+device_timezone%3D2%2C+os%3DLinux%3B+U%3B+Android+5.1.1%2C+auth%3D8yDhVenHT3Mp0O2QCLJFhCUfT73WR1mE2QRc1ZE7J22cRfmskdTmhCk9ssGWhoIBpIzoTEOLIqwl%0A47NaUwLoLZjH1i2WRYaiioIRMqhRvH2FsSuf1YG%2FFoT9fEw4CrxF%0A%2C+hdmi%3Dfalse%2C+firmwareversion%3DLMY48B.G361FXXU1APB1%7D
 *
 */
exports.get_favorite_tv_shows = function (req, res) {

    const pageLength = (req.app.locals.backendsettings[req.thisuser.company_id].vod_subset_nr) ? req.app.locals.backendsettings[req.thisuser.company_id].vod_subset_nr : 30; //max nr of movies in the response
    if (!req.query.page) req.query.page = 1; //if page param is missing, set page to 1
    const final_where = {};
    final_where.where = {};

    //set range of movies
    final_where.offset = (!req.query.page) ? 0 : (((parseInt(req.query.page) - 1)) * pageLength);
    final_where.limit = pageLength;

    //attribute list
    final_where.attributes = [
        'id', 'vote_count', 'vote_average', 'title', 'popularity', [sequelize.literal('"tv_series"'), 'vod_type'], 'trailer_url', 'createdAt', 'price', 'expiration_time',
        [db.sequelize.fn("concat", req.app.locals.backendsettings[req.thisuser.company_id].assets_url, db.sequelize.col('tv_series.image_url')), 'backdrop_path'],
        [db.sequelize.fn("concat", req.app.locals.backendsettings[req.thisuser.company_id].assets_url, db.sequelize.col('tv_series.icon_url')), 'poster_path'],
        'original_language', 'original_title', ['adult_content', 'adult'], ['description', 'overview'], [sequelize.fn('DATE_FORMAT', sequelize.col('tv_series.release_date'), '%Y-%m-%d'), 'release_date']
    ];

    if (req.query.search) {
        const q = decodeURIComponent(req.query.search);
        const like = {[Op.like]: sqlstring.format("?", ["%" + q.trim() + "%"]).replace(new RegExp("'", 'g'), "")};
        final_where.where = {
            [Op.or]: {
                title: like,
                original_title: like,
                description: like
            }
        }
    }

    //filter list
    final_where.where.company_id = req.thisuser.company_id;
    final_where.where.is_available = true; //return only available tv series
    final_where.where.expiration_time = {[Op.gte]: Date.now()}; //exclude tv series that have not expired yet
    final_where.where.pin_protected = (req.query.pin_protected === 'true') ? {[Op.in]: [true, false]} : false; //pin protected content returned only if request explicitly asks for it
    final_where.where.adult_content = (req.query.show_adult === 'true') ? {[Op.in]: [true, false]} : false; //adult content returned only if request explicitly asks for it

    //prepare order clause
    const order_by = (req.query.order_by) ? req.query.order_by : 'createdAt';
    const order_dir = (req.query.order_dir) ? req.query.order_dir : 'DESC';
    final_where.order = [[order_by, order_dir]];
    final_where.distinct = true; //ensures that the count does not include join results

    const categoryFilter = (req.query.category_id) ? {category_id: Number(req.query.category_id)} : {tv_show_id: {[Op.gt]: 0}}; //if specified, filter by category id
    const PACKAGE_TYPE = 2;
    models.package.findAll({
        attributes: ['id'],
        where: {package_type_id: req.auth_obj.screensize + PACKAGE_TYPE},
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
            {model: models.tv_series_categories, required: true, attributes: [], where: categoryFilter},
            {model: models.t_tv_series_sales, required: false, attributes: ['id'], where: {end_time: {[Op.gte]: Date.now()}}},
            {
                model: models.tv_season,
                attributes: ['id', 'season_number', 'title'],
                required: false,
                where: {expiration_time: {[Op.gte]: Date.now()}, is_available: true}
            },
            {
                model: models.tv_season,
                as: 'season',
                attributes: ['id', 'season_number', 'title'],
                required: false,
                where: {expiration_time: {[Op.gte]: Date.now()}, is_available: true},
                include: [{
                    model: models.tv_episode,
                    attributes: ['id', 'tv_season_id', 'season_number', 'episode_number'],
                    required: false,
                    where: {expiration_time: {[Op.gte]: Date.now()}, is_available: true},
                    include: [{
                        model: models.tv_episode_resume,
                        required: false,
                        where: {login_id: req.thisuser.id},
                        attributes: ['updatedAt']
                    }]
                }]
            },
            {model: models.tv_series_packages, required: false, attributes: ['id'], where: {package_id: {[Op.in]: package_list}}},
            {
                model: models.tv_series_resume,
                required: true,
                attributes: ['id', 'favorite', 'reaction'],
                where: {favorite: 1, login_id: req.thisuser.id}
            }
        ];



        //start query
        models.tv_series.findAndCountAll(
            final_where
        ).then(function (results) {
            let tv_show_list = [];
            const transactional_vod_duration = req.app.locals.backendsettings[req.thisuser.company_id].t_vod_duration;
            async.each(results.rows, function (tv_show, callback) {
                tv_show = tv_show.toJSON();

                const subscription_list = !!(tv_show.tv_series_packages && tv_show.tv_series_packages.length > 0);
                const purchased = !!(tv_show.t_tv_series_sales && tv_show.t_tv_series_sales.length > 0);
                const available_for_purchase = !!(tv_show.price > 0 && transactional_vod_duration && (moment(tv_show.expiration_time) > moment().add(transactional_vod_duration, 'day')));

                if (subscription_list || purchased || available_for_purchase) {
                    //find last watched episode
                    tv_show.last_watched = {};
                    let last_watched_date = null;
                    for (let i = 0; i < tv_show.season.length; i++) {
                        for (let j = 0; j < tv_show.season[i].tv_episodes.length; j++) {
                            if (tv_show.season[i].tv_episodes[j].tv_episode_resumes[0] && last_watched_date < tv_show.season[i].tv_episodes[j].tv_episode_resumes[0].updatedAt) {
                                last_watched_date = tv_show.season[i].tv_episodes[j].tv_episode_resumes[0].updatedAt;
                                tv_show.last_watched = {
                                    "episode_id": tv_show.season[i].tv_episodes[j].id,
                                    "season_id": tv_show.season[i].tv_episodes[j].tv_season_id,
                                    "season_number": tv_show.season[i].tv_episodes[j].season_number,
                                    "episode_number": tv_show.season[i].tv_episodes[j].episode_number
                                };
                            }
                        }
                    }

                    //delete data not needed by the application
                    delete tv_show.season;
                    delete tv_show.createdAt;
                    delete tv_show.t_tv_series_sales;
                    delete tv_show.tv_series_packages;

                    tv_show_list.push(tv_show); //load the tv show object in the response data
                    callback(null);
                } else callback(null);
            }, function (error, result) {
                const vod_list = {
                    "page": Number(req.query.page), //page number
                    "total_results": results.count, //number of vod items in total for this user
                    "total_pages": Math.ceil(results.count / pageLength), //number of pages for this user
                    "results": tv_show_list //return found records
                };
                res.setHeader("X-Total-Count", results.count);
                response.send_res_get(req, res, vod_list, 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'private,max-age=86400');
            });
        }).catch(function (error) {
            winston.error("Getting the tv show list failed with error: ", error);
            response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
        });

        return null;
    }).catch(function (error) {
        winston.error("Getting the vod package list failed with error: ", error);
        response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
    });

};


/**
 * @api {put} /apiv3/tv_show/reaction/:tv_show_id/:reaction Send TV Show Reaction
 * @apiVersion 0.3.0
 * @apiName TvShowDetails
 * @apiGroup TV SHOWS
 *
 * @apiUse header_auth
 * @apiParam {Integer} tv_show_id The id of TV show.
 * @apiParam {Integer} reaction The value of reaction for TV show: -1 (thumbs down), 0 (remove thumb down/up), 1 (thumbs up).
 * @apiDescription Saves client reaction for a tv_show. Reaction values are -1 (thumbs down), 0 (remove thumb down/up), 1 (thumbs up)
 *
 * Also saves watch position. Watch position should be an integer in the interval ]0, 100[
 *
 * Copy paste this auth for testing purposes
 * auth=%7Bapi_version%3D22%2C+appversion%3D1.1.4.2%2C+screensize%3D480x800%2C+appid%3D2%2C+devicebrand%3D+SM-G361F+Build%2FLMY48B%2C+language%3Deng%2C+ntype%3D1%2C+app_name%3DMAGOWARE%2C+device_timezone%3D2%2C+os%3DLinux%3B+U%3B+Android+5.1.1%2C+auth%3D8yDhVenHT3Mp0O2QCLJFhCUfT73WR1mE2QRc1ZE7J22cRfmskdTmhCk9ssGWhoIBpIzoTEOLIqwl%0A47NaUwLoLZjH1i2WRYaiioIRMqhRvH2FsSuf1YG%2FFoT9fEw4CrxF%0A%2C+hdmi%3Dfalse%2C+firmwareversion%3DLMY48B.G361FXXU1APB1%7D
 *
 */
exports.reaction = function (req, res) {
    models.tv_series_resume.findOne({
        where: {
            login_id: req.thisuser.id,
            tv_series_id: req.params.tv_show_id,
        }
    }).then(tv_series_resume => {
        models.tv_series_resume.upsert(
            {
                login_id: req.thisuser.id,
                tv_series_id: req.params.tv_show_id,
                company_id: req.thisuser.company_id,
                reaction: req.params.reaction,
                device_id: req.auth_obj.boxid
            }).catch(function (error) {
            winston.error("Saving the client's reaction for tv_show failed with error: ", error);
            response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
        }); return null;
    }).then(function (result) {
        response.send_res_get(req, res, [], 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'no-store');
    }).catch(function (error) {
        winston.error("Saving the client's reaction for tv_show failed with error: ", error);
        response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
    });
};



/**
 * @api {put} /apiv3/tv_show/favorite/:tv_show_id/:favorite Send TV Show Favorite
 * @apiVersion 0.3.0
 * @apiName TvShowDetails
 * @apiGroup TV SHOWS
 *
 * @apiUse header_auth
 * @apiParam {Integer} tv_show_id The id of TV show.
 * @apiParam {Integer} favorite The value of favorite for TV show: 0 (default), 1 (favorite/watchlist).
 * @apiDescription Saves tv_show favorite. Favorite values are 0 (default), 1 (favorite/watchlist)
 *
 *
 * Copy paste this auth for testing purposes
 *auth=%7Bapi_version%3D22%2C+appversion%3D1.1.4.2%2C+screensize%3D480x800%2C+appid%3D2%2C+devicebrand%3D+SM-G361F+Build%2FLMY48B%2C+language%3Deng%2C+ntype%3D1%2C+app_name%3DMAGOWARE%2C+device_timezone%3D2%2C+os%3DLinux%3B+U%3B+Android+5.1.1%2C+auth%3D8yDhVenHT3Mp0O2QCLJFhCUfT73WR1mE2QRc1ZE7J22cRfmskdTmhCk9ssGWhoIBpIzoTEOLIqwl%0A47NaUwLoLZjH1i2WRYaiioIRMqhRvH2FsSuf1YG%2FFoT9fEw4CrxF%0A%2C+hdmi%3Dfalse%2C+firmwareversion%3DLMY48B.G361FXXU1APB1%7D
 *
 */
exports.favorite = function (req, res) {
    models.tv_series_resume.findOne({
        where: {
            login_id: req.thisuser.id,
            tv_series_id: req.params.tv_show_id,
        }
    }).then(tv_series_resume => {
        models.tv_series_resume.upsert(
            {
                login_id: req.thisuser.id,
                tv_series_id: req.params.tv_show_id,
                company_id: req.thisuser.company_id,
                device_id: req.auth_obj.boxid,
                favorite: req.params.favorite
            }).catch(function (error) {
            winston.error("Saving the client's favorite tv_show failed with error: ", error);
            response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
        }); return null;
    }).then(function (result) {
        response.send_res_get(req, res, [], 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'no-store');
    }).catch(function (error) {
        winston.error("Saving the client's favorite tv_show failed with error: ", error);
        response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
    });
};



/**
 * @api {get} /apiv3/tv_show/tv_show_details/:tv_show_id Get TV SHow Details
 * @apiName TvShowDetails
 * @apiGroup TV SHOWS
 *
 * @apiUse header_auth
 *
 *@apiDescription Returns information about a tv show
 *
 * Copy paste this auth for testing purposes
 *auth=%7Bapi_version%3D22%2C+appversion%3D1.1.4.2%2C+screensize%3D480x800%2C+appid%3D2%2C+devicebrand%3D+SM-G361F+Build%2FLMY48B%2C+language%3Deng%2C+ntype%3D1%2C+app_name%3DMAGOWARE%2C+device_timezone%3D2%2C+os%3DLinux%3B+U%3B+Android+5.1.1%2C+auth%3D8yDhVenHT3Mp0O2QCLJFhCUfT73WR1mE2QRc1ZE7J22cRfmskdTmhCk9ssGWhoIBpIzoTEOLIqwl%0A47NaUwLoLZjH1i2WRYaiioIRMqhRvH2FsSuf1YG%2FFoT9fEw4CrxF%0A%2C+hdmi%3Dfalse%2C+firmwareversion%3DLMY48B.G361FXXU1APB1%7D
 *
 */
exports.tv_show_details = function (req, res) {

    models.tv_series_resume.findOne({
        where: {
            tv_series_id :req.params.tv_show_id,
            login_id: req.thisuser.id
        }
    }).then((result)=>{
       if(!result){
           db.models.tv_series_resume.create({
               login_id: req.thisuser.id,
               tv_series_id: req.params.tv_show_id,
               company_id: req.thisuser.company_id,
               reaction: req.params.reaction,
               device_id: req.auth_obj.boxid,
               favorite: 0
           })
       }
       else {
           db.models.tv_series_resume.findOne({
               where : {
                   login_id : req.thisuser.id,
                   tv_series_id: req.params.tv_show_id
               }
           }).then((tv_series_resume)=>{
               models.tv_series_resume.update({
                   login_id: req.thisuser.id,
                   vod_id: req.params.vod_id,
                   company_id: req.thisuser.company_id,
                   device_id: req.auth_obj.boxid
               },
                   { where: {id : tv_series_resume.id }} );
           })
       }
    })

    const transactional_vod_duration = req.app.locals.backendsettings[req.thisuser.company_id].t_vod_duration;
    const attributes = [
        'id', 'title', ['adult_content', 'adult'], [sequelize.literal('"tv_series"'), 'vod_type'], 'homepage', 'budget', 'price', 'mandatory_ads', 'imdb_id', 'original_language', 'original_title', 'expiration_time',
        'cast', 'director', ['description', 'overview'], 'tagline', 'popularity', 'vote_count', 'vote_average', 'revenue', 'spoken_languages', 'status',
        'episode_runtime', 'production_company', 'origin_country', 'trailer_url',
        [db.sequelize.fn("concat", req.app.locals.backendsettings[req.thisuser.company_id].assets_url, db.sequelize.col('tv_series.image_url')), 'backdrop_path'],
        [db.sequelize.fn("concat", req.app.locals.backendsettings[req.thisuser.company_id].assets_url, db.sequelize.col('tv_series.icon_url')), 'poster_path'],
        [sequelize.fn('DATE_FORMAT', sequelize.col('tv_series.release_date'), '%Y-%m-%d'), 'first_air_date'], 'rate'
    ];

    models.tv_series.findOne({
        attributes: attributes,
        include: [
            {
                model: models.tv_series_categories,
                attributes: ['id'],
                required: true,
                include: [{model: models.vod_category, attributes: ['id', 'name'], required: true}]
            },
            {
                model: models.t_tv_series_sales,
                attributes: ['id'],
                required: false,
                where: {login_data_id: req.thisuser.id, tv_show_id: req.params.tv_show_id, end_time: {[Op.gte]: Date.now()}}
            },
            {
                model: models.tv_season,
                attributes: ['id', 'season_number', 'title'],
                required: false,
                where: {expiration_time: {[Op.gte]: Date.now()}, is_available: true}
            },
            {
                model: models.tv_season,
                as: 'season',
                attributes: ['id'],
                required: false,
                where: {expiration_time: {[Op.gte]: Date.now()}, is_available: true},
                include: [{
                    model: models.tv_episode,
                    attributes: ['id', 'tv_season_id', 'season_number', 'episode_number'],
                    required: false,
                    where: {expiration_time: {[Op.gte]: Date.now()}, is_available: true},
                    include: [{
                        model: models.tv_episode_resume,
                        attributes: ['updatedAt'],
                        required: false,
                        where: {login_id: req.thisuser.id}
                    }]
                }]
            },
            {
                model: models.tv_series_resume,
                attributes: ['tv_series_id', 'reaction', 'favorite'],
                required: false,
                where: {login_id: req.thisuser.id}
            },
        ],
        where: {
            id: req.params.tv_show_id,
            is_available: true,
            expiration_time: {[Op.gte]: Date.now()},
            company_id: req.thisuser.company_id
        }
    }).then(async function (result) {
        if (!result) {
            response.send_res_get(req, res, [], 200, 1, 'NOT_FOUND_DESCRIPTION', 'NO_DATA_FOUND', 'private,max-age=86400');
        } else {
            const tmdbId = await getTvShowTMDbId(result.original_title || result.title);
            result.dataValues = { ...result.dataValues, ...tmdbId };

            //check whether vod item is part of the user's active subscription
            models.subscription.findOne({
                attributes: ['id'], where: {login_id: req.thisuser.id, end_date: {[Op.gte]: Date.now()}}, include: [
                    {
                        model: models.package,
                        attributes: ['id'],
                        required: true,
                        where: {package_type_id: req.auth_obj.screensize + 2},
                        include: [
                            {
                                model: models.tv_series_packages,
                                attributes: ['id'],
                                where: {tv_show_id: req.params.tv_show_id},
                                required: true
                            }
                        ]
                    }
                ],
                subQuery: false //prevent generation of subqueries, which can cause valid subscriptions not being returned
            }).then(function (subscription_result) {
                var available_purchase = ((result.t_tv_series_sales && result.t_tv_series_sales.length > 0)) ? true : false;
                var available_for_purchase = (transactional_vod_duration && (moment(result.expiration_time) > moment().add(transactional_vod_duration, 'day')) && (result.price > 0)) ? true : false;

                if (!subscription_result && !available_purchase && !available_for_purchase) {
                    response.send_res_get(req, res, [], 200, 1, 'NOT_FOUND_DESCRIPTION', 'NO_DATA_FOUND', 'private,max-age=86400');
                } else {
                    var vod_data = {};
                    vod_data = result.toJSON(); //convert query results from instance to JSON, to modify it

                    //prepare dynamic button list based on client rights to play the item
                    vod_data.actions = [
                        {name: "related", description: "Related"},
                        {name: "trailer", description: "Trailer"},
                        {name: "thumbup", description: "Thumbup"},
                        {name: "thumbdown", description: "Thumbdown"}
                    ];

                    if (available_purchase || subscription_result) vod_data.actions.push({
                        name: "play",
                        description: "Play"
                    });
                    else if (available_for_purchase) vod_data.actions.push({name: "buy", description: "Buy"});
                    delete vod_data.t_tv_series_sales;

                    //prepare array of categories
                    vod_data.genres = [];
                    for (var k = 0; k < vod_data.tv_series_categories.length; k++) vod_data.genres.push({
                        "id": vod_data.tv_series_categories[k].vod_category.id,
                        "name": vod_data.tv_series_categories[k].vod_category.name
                    });
                    delete vod_data.tv_series_categories;

                    //prepare object of last watched episode
                    vod_data.last_watched = {};
                    var last_watched_date = null;
                    for (var i = 0; i < vod_data.season.length; i++) {
                        for (var j = 0; j < vod_data.season[i].tv_episodes.length; j++) {
                            if (vod_data.season[i].tv_episodes[j].tv_episode_resumes[0] && last_watched_date < vod_data.season[i].tv_episodes[j].tv_episode_resumes[0].updatedAt) {
                                last_watched_date = vod_data.season[i].tv_episodes[j].tv_episode_resumes[0].updatedAt;
                                vod_data.last_watched = {
                                    "episode_id": vod_data.season[i].tv_episodes[j].id,
                                    "season_id": vod_data.season[i].tv_episodes[j].tv_season_id,
                                    "season_number": vod_data.season[i].tv_episodes[j].season_number,
                                    "episode_number": vod_data.season[i].tv_episodes[j].episode_number
                                };
                            }
                        }
                    }
                    delete vod_data.season;

                    //add url where client can buy a movie
                    vod_data.payment_url = req.app.locals.backendsettings[req.thisuser.company_id].assets_url + "/apiv3/vod_payment/vod_purchase/" + vod_data.id + '/' + req.thisuser.username;

                    //delete expiration time, application does not need it
                    delete vod_data.expiration_time;

                    vod_data.vod_resumes = {
                        "reaction": Math.floor(Math.random() * 3) - 1
                    };
                    response.send_res_get(req, res, [vod_data], 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'private,max-age=86400');
                }
            }).catch(function (error) {
                winston.error("Querying for the user's subscription failed with error: ", error);
                response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
            });
            return null;
        }
    }).catch(function (error) {
        winston.error("Querying for the details of the tv show item failed with error: ", error);
        response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
    });

};


/**
 * @api {get} /apiv3/tv_show/episode_list/:tv_show_id/:season_number Get Episode List
 * @apiName GetEpisodeList
 * @apiGroup TV SHOWS
 *
 * @apiUse header_auth
 *
 * @apiParam {Number} [page] Pagination number
 * @apiParam {String} [search]  Partial search string. Searches in following fields: title, original_title, description, tagline, cast, director
 * @apiParam {String} [pin_protected]  Flag for pin protected content. If set to true, pin protected content is included in the response. Value set: ['true']
 * @apiParam {String} [show_adult]  Flag for adult content. If set to true, adult content is included in the response. Value set: ['true']
 * @apiParam {String} [order_by] Orders items by a specified field. Episode order is the default. Value set is [clicks, rate, vote_average, vote_count, popularity, duration, pin_protected, adult_content, isavailable, expiration_time, price, revenue, budget, release_date]
 * @apiParam {String} [order_dir] Order direction. Descending is default. Value set is [desc, asc]
 *
 *@apiDescription Copy paste this auth for testing purposes
 *auth=%7Bapi_version%3D22%2C+appversion%3D1.1.4.2%2C+screensize%3D480x800%2C+appid%3D2%2C+devicebrand%3D+SM-G361F+Build%2FLMY48B%2C+language%3Deng%2C+ntype%3D1%2C+app_name%3DMAGOWARE%2C+device_timezone%3D2%2C+os%3DLinux%3B+U%3B+Android+5.1.1%2C+auth%3D8yDhVenHT3Mp0O2QCLJFhCUfT73WR1mE2QRc1ZE7J22cRfmskdTmhCk9ssGWhoIBpIzoTEOLIqwl%0A47NaUwLoLZjH1i2WRYaiioIRMqhRvH2FsSuf1YG%2FFoT9fEw4CrxF%0A%2C+hdmi%3Dfalse%2C+firmwareversion%3DLMY48B.G361FXXU1APB1%7D
 *
 */
exports.episode_list = function (req, res) {

  const page_length = (req.app.locals.backendsettings[req.thisuser.company_id].vod_subset_nr) ? req.app.locals.backendsettings[req.thisuser.company_id].vod_subset_nr : 30; //max nr of movies in the response
  if (!req.query.page) req.query.page = 1; //if page param is missing, set page to 1
  let final_where = {};
  final_where.where = {};

  //set range of movies
  final_where.offset = (!req.query.page) ? 0 : (((parseInt(req.query.page) - 1)) * page_length);
  final_where.limit = page_length;

  //attribute list
  final_where.attributes = [
    'id', 'vote_count', 'vote_average', 'title', 'popularity', [sequelize.literal('"tv_episode"'), 'vod_type'], 'tagline',
    [db.sequelize.fn("concat", req.app.locals.backendsettings[req.thisuser.company_id].assets_url, db.sequelize.col('image_url')), 'backdrop_path'], 'original_language', 'original_title',
    [db.sequelize.fn("concat", req.app.locals.backendsettings[req.thisuser.company_id].assets_url, db.sequelize.col('icon_url')), 'poster_path'],
    ['adult_content', 'adult'], ['description', 'overview'], [sequelize.fn('DATE_FORMAT', sequelize.col('release_date'), '%Y-%m-%d'), 'release_date']
  ];

  //prepare search condition by keyword
    if (req.query.search) {
        final_where.where = {
            [Op.or]: {
                title: { [Op.like]: '%' + req.query.search + '%' },
                original_title: { [Op.like]: '%' + req.query.search + '%' },
                description: { [Op.like]: '%' + req.query.search + '%' },
                tagline: { [Op.like]: '%' + req.query.search + '%' },
                director: { [Op.like]: '%' + req.query.search + '%' },
                cast: { [Op.like]: '%' + req.query.search + '%' }
            }
        }
    }

  //filter list
  final_where.where.company_id = req.thisuser.company_id;
  final_where.where.is_available = true; //return only available movies
  final_where.where.pin_protected = (!req.query.pin_protected) ? {[Op.in]: [true, false]} : false; //pin_protected content returned only if user settings allows it
  final_where.where.adult_content = (req.query.show_adult === 'true') ? {[Op.in]: [true, false]} : false; //adult content returned only if user settings allows it
  final_where.where.expiration_time = {[Op.gte]: Date.now()};

  //prepare order clause
  const order_by = (req.query.order_by) ? req.query.order_by : 'createdAt';
  const order_dir = (req.query.order_dir) ? req.query.order_dir : 'DESC';
  final_where.order = [[order_by, order_dir]];

  final_where.subQuery = false; //keeps subquery from generating

  models.tv_season.findOne({
    attributes: ['id'],
    where: {
      tv_show_id: req.params.tv_show_id,
      season_number: req.params.season_number,
      is_available: true,
      company_id: req.thisuser.company_id
    }
  }).then(function (season) {
      final_where.include = [
          {
              model: models.tv_episode_stream,
              attributes: ['stream_format', 'drm_platform', ['tv_episode_url', 'url'], 'token', 'token_url', 'encryption', 'encryption_url'],
              where: {
                  stream_source_id: req.thisuser.vod_stream_source,
                  stream_resolution: {[Op.like]: "%" + req.auth_obj.appid + "%"}
              },
              required: true
          }
      ];
    if (season && season.id) {
      final_where.where.tv_season_id = season.id;
      //start query
      models.tv_episode.findAndCountAll(
        final_where
      ).then(function (results) {
        const vod_list = {
          "page": Number(req.query.page), //page number
          "total_results": results.count, //number of vod items in total for this user
          "total_pages": Math.ceil(results.count / page_length), //number of pages for this user
          "results": results.rows //return found records
        };
        res.setHeader("X-Total-Count", results.count);
        response.send_res_get(req, res, vod_list, 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'private,max-age=86400');
      }).catch(function (error) {
        winston.error("Getting the movie list failed with error: ", error);
        response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
      });
      return null;
    } else {
      winston.error("Season with number " + req.query.season + " does not exist for this tv show");
      response.send_res_get(req, res, [], 200, 1, 'NOT_FOUND_DESCRIPTION', 'NO_DATA_FOUND', 'private,max-age=86400');
    }
  }).catch(function (error) {
    winston.error("Getting the episode list failed with error: ", error);
    response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
  });


};


/**
 * @api {get} /apiv3/tv_show/episode_details/:episode_id Get Episode Details
 * @apiName GetEpisodeDetails
 * @apiGroup TV SHOWS
 *
 * @apiUse header_auth
 *
 *@apiDescription Returns details of an episode
 *
 * Copy paste this auth for testing purposes
 *auth=%7Bapi_version%3D22%2C+appversion%3D1.1.4.2%2C+screensize%3D480x800%2C+appid%3D2%2C+devicebrand%3D+SM-G361F+Build%2FLMY48B%2C+language%3Deng%2C+ntype%3D1%2C+app_name%3DMAGOWARE%2C+device_timezone%3D2%2C+os%3DLinux%3B+U%3B+Android+5.1.1%2C+auth%3D8yDhVenHT3Mp0O2QCLJFhCUfT73WR1mE2QRc1ZE7J22cRfmskdTmhCk9ssGWhoIBpIzoTEOLIqwl%0A47NaUwLoLZjH1i2WRYaiioIRMqhRvH2FsSuf1YG%2FFoT9fEw4CrxF%0A%2C+hdmi%3Dfalse%2C+firmwareversion%3DLMY48B.G361FXXU1APB1%7D
 *
 */
exports.episode_details = function (req, res) {
  const attributes = [
    'id', ['adult_content', 'adult'], [sequelize.literal('"tv_episode"'), 'vod_type'], 'homepage', 'budget', 'mandatory_ads', 'imdb_id', 'original_language', 'original_title', 'expiration_time', 'price', 'status',
    'cast', 'director', 'title', ['description', 'overview'], ['duration', 'runtime'], 'vote_count', 'vote_average', 'popularity', 'revenue', 'tagline',
    [db.sequelize.fn("concat", req.app.locals.backendsettings[req.thisuser.company_id].assets_url, db.sequelize.col('image_url')), 'backdrop_path'],
    [db.sequelize.fn("concat", req.app.locals.backendsettings[req.thisuser.company_id].assets_url, db.sequelize.col('tv_episode.icon_url')), 'poster_path'],
    'trailer_url', 'vod_preview_url', 'default_subtitle_id', 'spoken_languages', [sequelize.fn('DATE_FORMAT', sequelize.col('release_date'), '%Y-%m-%d'), 'air_date']
  ];

  models.tv_episode.findOne({
    attributes: attributes,
    include: [
      {
        model: models.tv_episode_stream,
        attributes: ['stream_format', 'drm_platform', ['tv_episode_url', 'url'], 'token', 'token_url', 'encryption', 'encryption_url'],
        where: {
          stream_source_id: req.thisuser.vod_stream_source,
          stream_resolution: {[Op.like]: "%" + req.auth_obj.appid + "%"}
        },
        required: false
      },
      {
        model: models.tv_episode_subtitles,
        attributes: ['id', 'title', [db.sequelize.fn("concat", req.app.locals.backendsettings[req.thisuser.company_id].assets_url, db.sequelize.col('subtitle_url')), 'url'], ['tv_episode_id', 'vodid']]
      },
      {
        model: models.tv_episode_resume,
        attributes: ['resume_position'],
        required: false,
        where: {login_id: req.thisuser.id}
      }
    ],
    where: {
      id: req.params.episode_id,
      is_available: true,
      expiration_time: {[Op.gte]: Date.now()},
      company_id: req.thisuser.company_id
    }
  }).then(function (result) {

    if (result) {
      let vod_data = {};
      vod_data = result.toJSON(); //convert query results from instance to JSON, to modify it

      //find and asign value of default subtitle
      if (result.tv_episode_subtitles) {
        try {
          var found = result.tv_episode_subtitles.find(function (x) {
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

      //rename subtitle object
      vod_data.vod_subtitles = (vod_data.tv_episode_subtitles) ? vod_data.tv_episode_subtitles : [];
      delete vod_data.tv_episode_subtitles;

      //rename resume object
      vod_data.vod_resumes = (vod_data.tv_episode_resumes[0]) ? vod_data.tv_episode_resumes[0] : {};
      delete vod_data.tv_episode_resumes;

      //prepare stream object
      vod_data.vod_stream = (vod_data.tv_episode_streams && vod_data.tv_episode_streams[0]) ? vod_data.tv_episode_streams[0] : {};
      delete vod_data.tv_episode_streams;

      //prepare dynamic button list
      vod_data.actions = [
        {name: "trailer", description: "Trailer"},
        {name: "thumbup", description: "Thumbup"},
        {name: "thumbdown", description: "Thumbdown"}
      ];

      //add url where client can buy a movie
      vod_data.payment_url = req.app.locals.backendsettings[req.thisuser.company_id].assets_url + "/apiv3/vod_payment/vod_purchase/" + vod_data.id + '/' + req.thisuser.username;

      //prepare ads object
      vod_data.watch_mandatory_ad = {
        "get_ads": (req.thisuser.get_ads || vod_data.mandatory_ads) ? 1 : 0,
        "vast_ad_url": (req.app.locals.backendsettings[req.thisuser.company_id].vast_ad_url)
      };
      delete vod_data.mandatory_ads;

      delete vod_data.expiration_time; //delete expiration time, application does not need it

      vod_data.resume_position = Math.floor(Math.random() * 98) + 1;

      response.send_res_get(req, res, [vod_data], 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'private,max-age=86400'); //send details object
    } else response.send_res_get(req, res, [], 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'private,max-age=86400'); //send details object

  }).catch(function (error) {
    winston.error("Querying for the details of the episode failed with error: ", error);
    response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
  });

};


/**
 * @api {get} /apiv3/tv_show/related_shows/:tv_show_id Get Related TV Shows
 * @apiName GetRelatedTVShows
 * @apiGroup TV SHOWS
 *
 * @apiUse header_auth
 *
 * @apiParam {Number} [page] Page (pagination) number. If missing, returns first page
 * @apiParam {String} [show_adult] Flag for adult content. Only if set to true, adult content is included in the response
 * @apiParam {String} [pin_protected] Flag for pin protected content. Only if set to true, pin protected content is included in the response
 *
 *@apiDescription Returns paginated list of related tv shows (from most related to least). Number of items per page is specified in the company settings (30 by default).
 *
 * Expired and non-available tv shows are not returned. By default, pin protected or adult tv shows are not returned, unless specified otherwise.
 *
 * The tv show genre, director and cast are used as match criteria. Tv shows that don't belong to any genre are excluded.
 *
 * Copy paste this auth for testing purposes
 *auth=%7Bapi_version%3D22%2C+appversion%3D1.1.4.2%2C+screensize%3D480x800%2C+appid%3D2%2C+devicebrand%3D+SM-G361F+Build%2FLMY48B%2C+language%3Deng%2C+ntype%3D1%2C+app_name%3DMAGOWARE%2C+device_timezone%3D2%2C+os%3DLinux%3B+U%3B+Android+5.1.1%2C+auth%3D8yDhVenHT3Mp0O2QCLJFhCUfT73WR1mE2QRc1ZE7J22cRfmskdTmhCk9ssGWhoIBpIzoTEOLIqwl%0A47NaUwLoLZjH1i2WRYaiioIRMqhRvH2FsSuf1YG%2FFoT9fEw4CrxF%0A%2C+hdmi%3Dfalse%2C+firmwareversion%3DLMY48B.G361FXXU1APB1%7D
 *
 */
exports.related_shows = function (req, res) {

  const page_length = (req.app.locals.backendsettings.vod_subset_nr) ? req.app.locals.backendsettings.vod_subset_nr : 30; //max nr of movies in the response
  if (!req.query.page) req.query.page = 1; //if page param is missing, set page to 1

  //set range of movies
  const offset = (!req.query.page) ? 0 : (((parseInt(req.query.page) - 1)) * page_length);
  const limit = page_length; //number of records per request

  models.tv_series.findAll({
    attributes: ['director', 'cast', [sequelize.literal('"tv_series"'), 'vod_type']],
    where: {id: req.params.tv_show_id},
    limit: 1
  }).then(function (result) {
    if (result && result.length > 0) {

      const director_list = result[0].director.split(',');
      let director_matching_score = "";
      for (let i = 0; i < director_list.length; i++) {
        const directorEncoded = director_list[i].replace(new RegExp("\\'", "gi"), "\\'");
        if (i === director_list.length - 1) director_matching_score = director_matching_score + " IF( ( director like '%" + directorEncoded.trim() + "%' ), 0.5, 0)";
        else director_matching_score = director_matching_score + " IF( ( director like '%" + directorEncoded.trim() + "%' ), 0.5, 0) + "
      }

      const actor_list = result[0].cast.split(',');
      let actor_matching_score = "";
      for (let j = 0; j < actor_list.length; j++) {
        const actorEncoded = actor_list[j].replace(new RegExp("\\'", "gi"), "\\'");
        if (j === actor_list.length - 1) actor_matching_score = actor_matching_score + " IF( ( cast like '%" + actorEncoded.trim() + "%' ), 0.3, 0)";
        else actor_matching_score = actor_matching_score + " IF( ( cast like '%" + actorEncoded.trim() + "%' ), 0.3, 0) + "
      }

      //prepare the where clause
      let where_condition = "";
      where_condition += " tv_series.id <> " + req.params.tv_show_id; //exclude current tv show from list
      where_condition += " AND tv_series.is_available = true"; //return only available tv shows
      where_condition += " AND expiration_time > NOW() "; //do not return tv shows that have expired
      if (!req.query.pin_protected || req.query.pin_protected !== 'true') where_condition += " AND pin_protected = false"; //return pin_protected content only if explicitly allowed
      if (!req.query.show_adult || req.query.show_adult !== "true") where_condition += " AND adult_content = false "; //return adult content only if explicitly allowed


      const related_query = "SELECT " +
        "DISTINCT tv_series.id, tv_series.vote_count, tv_series.vote_average, tv_series.title, tv_series.popularity, tv_series.original_language, tv_series.original_title," +
        " tv_series.adult_content as adult, tv_series.description as overview, 'tv_series' as vod_type, " +
        " tv_series.trailer_url, concat('" + req.app.locals.backendsettings[req.thisuser.company_id].assets_url + "', tv_series.image_url) as backdrop_path," +
        " concat('" + req.app.locals.backendsettings[req.thisuser.company_id].assets_url + "', tv_series.icon_url) as poster_path," +
        " DATE_FORMAT(tv_series.release_date, '%Y-%m-%d') as release_date, " +
        " ( " +
        //" IF( (category_id = "+result[0].category_id+"), 1, 0) + "+ //category matching score
        " ( " + director_matching_score + " ) + " + //director matching score
        " ( " + actor_matching_score + " ) " + //actor matching score
        " ) AS matching_score " +
        " FROM tv_series " +
        " INNER JOIN tv_series_categories ON tv_series.id = tv_series_categories.tv_show_id " +
        " INNER JOIN vod_category ON tv_series_categories.category_id = vod_category.id " + //the similarity depends greatly on genre, so genre is required
        " WHERE " + where_condition +
        " GROUP BY tv_series.id " +
        " ORDER BY  matching_score DESC " + //order tv shows from most related to least related
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
    winston.error("Finding the tv show's attributes failed with error: ", error);
    response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
  });
};