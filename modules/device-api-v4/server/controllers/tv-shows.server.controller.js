'use strict'

const path = require('path'),
  db = require(path.resolve('./config/lib/sequelize')),
  models = db.models,
  response = require('../utils/response'),
  winston = require('winston'),
  sequelize = require('sequelize');

const Joi = require("joi");
const moment = require("moment");
const async = require("async");
const sqlstring = require("sqlstring");
const { Op } = require("sequelize");

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
      return Promise.resolve({tmdb_values: {tmdbId: -1}});
    } else {
      return Promise.resolve({tmdb_values: {tmdbId: gettmdbid.data.results[0].id}});
    }
  } catch (error) {
    return Promise.resolve({tmdb_values: {tmdbId: -1}});
  }
}

/**
 * @api {get} /apiv4/tv_shows/list Get TvShows List
 * @apiVersion 4.0.0
 * @apiName GetVodList
 * @apiGroup VOD_V4
 *
 * @apiHeader {String} x-access-token Users JWT token.
 * @apiDescription Retrieve movies list.
 * @apiParam {Number} [page] Page (pagination) number. If missing, returns first page.
 * @apiParam {String} [pin_protected]  Unless specified otherwise, return only items that are not pin protected. Value set [true, false]
 * @apiParam {String} [show_adult]  Unless specified otherwise, return only items that are not adult content. Value set [true, false]
 * @apiParam {Number} [category_id] Filter vod items by category id
 * @apiParam {String} [order_by] Orders items by a specified field. Creation date is the default. Value set is [clicks, rate, vote_average, vote_count, popularity, duration, pin_protected, adult_content, isavailable, expiration_time, price, revenue, budget, release_date]
 * @apiParam {String} [order_dir] Order direction. Descending is default. Value set is [desc, asc]
 *
 *@apiDescription Returns paginated list of movies. Number of items per page is specified in the company settings (30 by default).
 * Expired and non-available movies are not returned. By default, pin protected or adult movies are not returned, unless specified otherwise.
 * Only movies belonging to at least a genre are returned.
 *
 * @apiSuccessExample Success-Response:
 *   HTTP/1.1 200 OK
 {
      "data": {
          "page": 1,
          "total_results": 1,
          "total_pages": 1,
          "results": [
              {
                  "id": 1,
                  "rate": 9,
                  "title": "test",
                  "vod_type": "film",
                  "trailer_url": "https://www.youtube.com/watch?v=O0s5fvRtBOo",
                  "price": 0,
                  "expiration_time": "3017-12-31T23:00:00.000Z",
                  "backdrop_path": "https://devapp.magoware.tv/1/files/vod/1590760020221120x120.png",
                  "poster_path": "https://devapp.magoware.tv/1/files/vod/1590760004290120x120.png",
                  "original_language": "en",
                  "original_title": "te",
                  "adult": 0,
                  "overview": "tt",
                  "release_date": "1896-12-28",
                  "pin_protected": 0
              }
          ]
      }
}
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
exports.getTvShowList = async function (req, res) {
  const companyId = req.user.company_id;
  const settings = req.app.locals.backendsettings[companyId];
  const pageLength = settings.vod_subset_nr ? settings.vod_subset_nr : 30;

  const schema = Joi.object().keys({
    page: Joi.number().integer().default(1),
    category_id: Joi.number().integer(),
    pin_protected: Joi.boolean().default(false),
    adult_content: Joi.boolean().default(false),
    order_dir: Joi.string().valid('ASC', 'DESC', 'asc', 'desc').default('DESC'),
    order_by: Joi.string().default("createdAt"),
  });

  const {error, value} = schema.validate(req.query);
  const {page, pin_protected, adult_content, order_by, order_dir, category_id} = value;

  if (error) {
    return response.sendError(req, res, 400, 60)
  }

  const attributes = [
    'id', 'rate', 'title', [sequelize.literal('"tv_series"'), 'vod_type'], 'trailer_url', 'price', 'expiration_time',
    [db.sequelize.fn("concat", settings.assets_url, db.sequelize.col('tv_series.image_url')), 'backdrop_path'],
    [db.sequelize.fn("concat", settings.assets_url, db.sequelize.col('tv_series.icon_url')), 'poster_path'],
    'original_language', 'original_title', ['adult_content', 'adult'], ['description', 'overview'], [sequelize.fn('DATE_FORMAT', sequelize.col('tv_series.release_date'), '%Y-%m-%d'), 'release_date'], 'pin_protected'
  ];

  const whereConditions = {
    is_available: true,
    company_id: companyId,
    expiration_time: {[Op.gte]: Date.now()},
    pin_protected: pin_protected ? {[Op.in]: [true, false]} : false,
    adult_content: adult_content ? {[Op.in]: [true, false]} : false,
  }

  const vod_vod_category_filter = (category_id) ? {category_id: category_id} : {tv_show_id: {[Op.gt]: 0}};

  try {
    const packages = await models.package.findAll({
      attributes: ['id'],
      where: {package_type_id: req.auth.data.screensize + 2},
      include: [{
        model: models.subscription,
        required: true,
        attributes: ['id'],
        where: {login_id: req.user.id, end_date: {[Op.gte]: Date.now()}}
      }]
    });

    const package_list = packages.map(pkg => pkg.id);
    let include = [
      {model: models.tv_series_categories, required: true, attributes: [], where: vod_vod_category_filter},
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
            where: {login_id: req.user.id},
            attributes: ['updatedAt']
          }]
        }]
      },
      {model: models.tv_series_packages, required: false, attributes: ['id'], where: {package_id: {[Op.in]: package_list}}}
    ];

    const final = {
      attributes,
      where: whereConditions,
      subQuery: false,
      distinct: true,
      offset: (page - 1) * pageLength,
      limit: pageLength,
      order: [[order_by, order_dir]],
      include
    }

    const results = await models.tv_series.findAndCountAll(final);

    let tv_show_list = [];
    const transactional_vod_duration = settings.t_vod_duration;
    await async.forEach(results.rows, function (tv_show, callback) {
      tv_show = tv_show.toJSON();

      const subscription_list = !!(tv_show.tv_series_packages && tv_show.tv_series_packages.length > 0);
      const purchased = !!(tv_show.t_tv_series_sales && tv_show.t_tv_series_sales.length > 0);
      const available_for_purchase = !!(tv_show.price > 0 && transactional_vod_duration && (moment(tv_show.expiration_time) > moment().add(transactional_vod_duration, 'day')));

      if (subscription_list || purchased || available_for_purchase) {
        delete tv_show.season;
        delete tv_show.createdAt;
        delete tv_show.t_tv_series_sales;
        delete tv_show.tv_series_packages;

        tv_show_list.push(tv_show); //load the tv show object in the response data
        callback(null);
      } else callback(null);
    }, function (error, result) {
      if (error) throw new Error(error);
      const vod_list = {
        page: page, //page number
        total_results: results.count, //number of vod items in total for this user. This is a maximum bound, not the exact number
        total_pages: Math.ceil(results.count / pageLength), //number of pages for this user. This is a maximum bound, not the exact number
        results: tv_show_list //return found records
      };
      res.setHeader("X-Total-Count", results.count);
      response.sendData(req, res, vod_list);
    });

  } catch (error) {
    winston.error("Getting the vod v4 list failed with error: ", error);
    response.sendError(req, res, 500, 51);
  }
};

/**
 * @api {get} /apiv4/tv_shows/details/:tvShowId Get Vod List
 * @apiVersion 4.0.0
 * @apiName GetVodList
 * @apiGroup VOD_V4
 *
 * @apiHeader {String} x-access-token Users JWT token.
 * @apiDescription Retrieve movies list.
 * @apiParam {Number} [tvShowId] Tv Show ID
 *
 *@apiDescription Returns the tv show details
 * @apiSuccessExample Success-Response:
 *   HTTP/1.1 200 OK
 {
    "data": {
        "id": 1,
        "title": "Serial test",
        "adult": 0,
        "vod_type": "tv_series",
        "homepage": "",
        "budget": 0,
        "price": 1,
        "imdb_id": "5",
        "original_language": "en",
        "original_title": "",
        "expiration_time": "3017-12-31T23:00:00.000Z",
        "cast": "TEST",
        "director": "john lindt",
        "overview": "TEST",
        "tagline": "",
        "popularity": 0,
        "vote_count": 0,
        "vote_average": 5,
        "revenue": 0,
        "spoken_languages": "[]",
        "status": "ongoing",
        "episode_runtime": null,
        "production_company": "",
        "origin_country": "",
        "trailer_url": "https://www.youtube.com/watch?v=O0s5fvRtBOo",
        "backdrop_path": "https://devapp.magoware.tv",
        "poster_path": "https://devapp.magoware.tv",
        "first_air_date": "1896-12-27",
        "rate": 5,
        "t_tv_series_sales": [],
        "tv_seasons": [
            {
                "id": 1,
                "season_number": 1,
                "title": "season 1"
            }
        ],
        "tv_series_resume": {
            "tv_series_id": 1,
            "reaction": 0,
            "favorite": 0
        },
        "tmdb_values": {
            "tmdbId": -1
        },
        "actions": [
            {
                "name": "related",
                "description": "Related"
            },
            {
                "name": "trailer",
                "description": "Trailer"
            },
            {
                "name": "thumbup",
                "description": "Thumb-up"
            },
            {
                "name": "thumbdown",
                "description": "Thumb-down"
            },
            {
                "name": "play",
                "description": "Play"
            }
        ],
        "reaction": null,
        "watch_mandatory_ad": {
            "get_ads": 0,
            "vast_ad_url": "https://servedbyadbutler.com/vast.spark?setID=5291&ID=173381&pid=57743"
        },
        "genres": [
            {
                "id": 1,
                "name": "Tv Show test"
            }
        ],
        "vod_stream": {},
        "payment_url": "https://devapp.magoware.tv/apiv3/vod_payment/vod_purchase/1/klendi11"
    }
}
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
exports.getTvShowDetails = async function (req, res) {
  const companyId = req.user.company_id;
  const settings = req.app.locals.backendsettings[companyId];
  const userId = req.user.id;
  const username = req.auth.data.username;
  const appId = req.auth.data.app_id;
  const lang = languages[req.body.language].language_variables;

  const schema = Joi.object().keys({
    tvShowId: Joi.number().integer().required()
  })

  const {error, value} = schema.validate(req.params)

  if (error) {
    return response.sendError(req, res, 400, 60)
  }
  const {tvShowId} = value;

  try {
    const transactionalVodDuration = settings.t_vod_duration;
    const attributes = [
      'id', 'title', ['adult_content', 'adult'], [sequelize.literal('"tv_series"'), 'vod_type'], 'homepage', 'budget', 'price', 'mandatory_ads', 'imdb_id', 'original_language', 'original_title', 'expiration_time',
      'cast', 'director', ['description', 'overview'], 'tagline', 'popularity', 'vote_count', 'vote_average', 'revenue', 'spoken_languages', 'status',
      'episode_runtime', 'production_company', 'origin_country', 'trailer_url',
      [db.sequelize.fn("concat", settings.assets_url, db.sequelize.col('tv_series.image_url')), 'backdrop_path'],
      [db.sequelize.fn("concat", settings.assets_url, db.sequelize.col('tv_series.icon_url')), 'poster_path'],
      [sequelize.fn('DATE_FORMAT', sequelize.col('tv_series.release_date'), '%Y-%m-%d'), 'first_air_date'], 'rate'
    ];

    const vodJoinList = [
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
        where: {login_data_id: userId, tv_show_id: tvShowId, end_time: {[Op.gte]: Date.now()}}
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
            where: {login_id: userId}
          }]
        }]
      },
      {
        model: models.tv_series_resume,
        attributes: ['tv_series_id', 'reaction', 'favorite'],
        required: false,
        where: {login_id: userId}
      }
    ];

    const subscriptionJoinList = [
      {
        model: models.package,
        attributes: ['id'],
        required: true,
        where: {package_type_id: req.auth.data.screensize + 2},
        include: [
          {
            model: models.tv_series_packages,
            attributes: ['id'],
            where: {tv_show_id: tvShowId},
            required: true
          }
        ]
      }
    ];

    const vodResultQuery = await models.tv_series.findOne({
      attributes: attributes,
      include: vodJoinList,
      where: {
        id: tvShowId,
        is_available: true,
        expiration_time: {[Op.gte]: Date.now()},
        company_id: companyId
      }
    });

    if (!vodResultQuery)
      return response.sendError(req, res, 404, 62)

    let vodResult = vodResultQuery.dataValues;

    let getTMBDid = await getTvShowTMDbId(vodResult.original_title || vodResult.title);
    vodResult = {...vodResult, ...getTMBDid};

    const subscriptionResult = models.subscription.findOne({
      attributes: ['id'],
      where: {login_id: userId, end_date: {[Op.gte]: Date.now()}},
      include: subscriptionJoinList,
      subQuery: false
    });

    const availablePurchase = !!((vodResult.t_vod_sales && vodResult.t_vod_sales.length > 0));
    const availableForPurchase = (transactionalVodDuration && (moment(vodResult.expiration_time) > moment().add(transactionalVodDuration, 'day')) && (vodResult.price > 0));

    if (!subscriptionResult && !availablePurchase && !availableForPurchase)
      return response.sendError(req, res, 400, 26)

    const reaction = await models.vod_resume.findOne({
      attributes: ['id', 'reaction'],
      where: {login_id: userId, vod_id: tvShowId},
      order: [['updatedAt', 'DESC']],
    });

    let actions = [
      {name: "related", description: lang["RELATED"]},
      {name: "trailer", description: lang["TRAILER"]},
      {name: "thumbup", description: lang["THUMBUP"]},
      {
        name: "thumbdown",
        description: lang["THUMBDOWN"]
      }
    ];
    //return play action for purchased movies, or those part of an active subscription
    if (availablePurchase || subscriptionResult)
      actions.push({
        name: "play",
        description: lang["PLAY"]
      });
    else if (availableForPurchase)
      actions.push({
        name: "buy",
        description: lang["BUY"]
      });

    delete vodResult.t_vod_sales;
    let defaultLanguage;
    if (vodResult.vod_subtitles && vodResult.vod_subtitles.length > 0) {
      defaultLanguage = vodResult.vod_subtitles.find(function (x) {
        if (x.id === (vodResult.default_subtitle_id)) {
          return x.title;
        }
      }).title;
    }

    delete vodResult.default_subtitle_id;

    let genres = [];
    for (let i = 0; i < vodResult.tv_series_categories.length; i++)
      genres.push({
        "id": vodResult.tv_series_categories[i].vod_category.id,
        "name": vodResult.tv_series_categories[i].vod_category.name
      });

    delete vodResult.tv_series_categories;
    const vod_stream = (vodResult.vod_streams && vodResult.vod_streams[0]) ? vodResult.vod_streams[0] : {};
    delete vodResult.vod_streams;
    const payment_url = settings.assets_url + "/apiv3/vod_payment/vod_purchase/" + vodResult.id + '/' + username;
    const watch_mandatory_ad = {
      "get_ads": (req.user.get_ads || vodResult.mandatory_ads) ? 1 : 0,
      "vast_ad_url": "https://servedbyadbutler.com/vast.spark?setID=5291&ID=173381&pid=57743"
    };
    delete vodResult.mandatory_ads;
    delete vodResult.season;

    // let vod_resumes;
    // if (vodResult.tv_series_resume.length < 1)
    //   vod_resumes = {
    //     "resume_position": 0,
    //     "reaction": 0
    //   };
    // else vod_resumes = vodResult.vod_resumes[0];

    const movie = {
      ...vodResult,
      actions,
      reaction,
      default_language: defaultLanguage,
      watch_mandatory_ad,
      // vod_resumes,
      genres,
      vod_stream,
      payment_url
    };

    response.sendData(req, res, movie);
  } catch (e) {
    winston.error("Getting the vod v4 details failed with error: ", e);
    response.sendError(req, res, 500, 51);
  }
}

/**
 * @api {get} /apiv4/tv_shows/episode/list/:tvShowId/:seasonId Get Episodes List
 * @apiVersion 4.0.0
 * @apiName GetEpisodesList
 * @apiGroup VOD_V4
 *
 * @apiHeader {String} x-access-token Users JWT token.
 * @apiDescription Retrieve movies list.
 * @apiParam {Number} [tvShowId] Tv Show ID
 * @apiParam {Number} [seasonId] Season ID
 *
 *@apiDescription Returns the episode list
 * @apiSuccessExample Success-Response:
 *   HTTP/1.1 200 OK
 {
    "data": {
        "page": 1,
        "total_results": 1,
        "total_pages": 1,
        "results": [
            {
                "id": 1,
                "vote_count": 0,
                "vote_average": 5,
                "title": "episode test",
                "popularity": 0,
                "vod_type": "tv_episode",
                "tagline": "",
                "backdrop_path": "https://devapp.magoware.tv/1/files/vod/1590754537600120x120.png",
                "original_language": "en",
                "original_title": "episode test",
                "poster_path": "https://devapp.magoware.tv/1/files/vod/1590754534393120x120.png",
                "adult": 0,
                "overview": "test",
                "release_date": "1896-12-27"
            }
        ]
    }
}
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
exports.getEpisodesList = async function (req, res) {
  const companyId = req.user.company_id;
  const settings = req.app.locals.backendsettings[companyId];
  const pageLength = settings.vod_subset_nr ? settings.vod_subset_nr : 30;

  const schema = Joi.object().keys({
    page: Joi.number().integer().default(1),
    pin_protected: Joi.boolean().default(false),
    show_adult: Joi.boolean().default(false),
    order_dir: Joi.string().valid('ASC', 'DESC', 'asc', 'desc').default('DESC'),
    order_by: Joi.string().default("createdAt")
  });

  const schema2 = Joi.object().keys({
    seasonId: Joi.number().integer().required(),
    tvShowId: Joi.number().integer().required()
  })

  const { error, value } = schema.validate(req.query);
  const { page, pin_protected, adult_content, order_by, order_dir} = value;

  const {error: paramsError, value: paramsValue} = schema2.validate(req.params);

  const { tvShowId, seasonId } = paramsValue;

  if (error || paramsError) {
    return response.sendError(req, res, 400, 60)
  }

  const attributes = [
    'id', 'vote_count', 'vote_average', 'title', 'popularity', [sequelize.literal('"tv_episode"'), 'vod_type'], 'tagline',
    [db.sequelize.fn("concat", settings.assets_url, db.sequelize.col('image_url')), 'backdrop_path'], 'original_language', 'original_title',
    [db.sequelize.fn("concat", settings.assets_url, db.sequelize.col('icon_url')), 'poster_path'],
    ['adult_content', 'adult'], ['description', 'overview'], [sequelize.fn('DATE_FORMAT', sequelize.col('release_date'), '%Y-%m-%d'), 'release_date']
  ];

  try {
    const season = await models.tv_season.findOne({
      attributes: ['id'],
      where: {
        tv_show_id: seasonId,
        id: tvShowId,
        is_available: true,
        company_id: req.user.company_id
      }
    });

    if(!season) return response.sendError(req, res, 404, 67);

    const whereConditions = {
      is_available: true,
      company_id: companyId,
      tv_season_id: season.id,
      expiration_time: {[Op.gte]: Date.now()},
      pin_protected: pin_protected ? {in: [true, false]} : false,
      adult_content: adult_content ? {in: [true, false]} : false,
    };

    const final = {
      attributes,
      where: whereConditions,
      subQuery: false,
      offset: (page - 1) * pageLength,
      limit: pageLength,
      order: [[order_by, order_dir]]
    };

    const tvEpisodes = await models.tv_episode.findAndCountAll(final);

    const vodList = {
      page: page,
      total_results: tvEpisodes.count,
      total_pages: Math.ceil(tvEpisodes.count / pageLength),
      results: tvEpisodes.rows
    };

    res.setHeader("X-Total-Count", tvEpisodes.count);
    response.sendData(req, res, vodList);

  } catch (error) {
    winston.error("Getting the vod v4 list failed with error: ", error);
    response.sendError(req, res, 500, 51);
  }
}

/**
 * @api {get} /apiv4/tv_shows/episode/details/:episodeId Get Vod List
 * @apiVersion 4.0.0
 * @apiName GetEpisodeDetails
 * @apiGroup TV_SHOWS_V4
 *
 * @apiHeader {String} x-access-token Users JWT token.
 * @apiDescription Retrieve movies list.
 * @apiParam {Number} [episodeId] Episode ID
 *
 *@apiDescription Returns the tv show details
 * @apiSuccessExample Success-Response:
 *   HTTP/1.1 200 OK
 {
    "data": {
        "id": 1,
        "adult": 0,
        "vod_type": "tv_episode",
        "homepage": "",
        "budget": 0,
        "imdb_id": "5",
        "original_language": "en",
        "original_title": "episode test",
        "expiration_time": "3017-12-31T23:00:00.000Z",
        "price": 1,
        "status": "released",
        "cast": "test",
        "director": "john lindt",
        "title": "episode test",
        "overview": "test",
        "runtime": 100,
        "vote_count": 0,
        "vote_average": 5,
        "popularity": 0,
        "revenue": 0,
        "tagline": "",
        "backdrop_path": "https://devapp.magoware.tv/1/files/vod/1590754537600120x120.png",
        "poster_path": "https://devapp.magoware.tv/1/files/vod/1590754534393120x120.png",
        "trailer_url": "https://www.youtube.com/watch?v=O0s5fvRtBOo",
        "vod_preview_url": "",
        "default_subtitle_id": 0,
        "spoken_languages": "[]",
        "air_date": "1896-12-27",
        "tv_episode_streams": [
            {
                "stream_format": "2",
                "drm_platform": "none",
                "url": "https://devapp.magoware.tv/admin/#/tv_episode_stream/create?defaultValues=%7B%22tv_episode_id%22:1%7D",
                "token": false,
                "token_url": "Token Url",
                "encryption": false,
                "encryption_url": "Encryption url"
            }
        ],
        "tv_episode_resumes": [],
        "vod_subtitles": [
            {
                "id": 1,
                "title": "test",
                "url": "https://devapp.magoware.tv/1/files/subtitles/1590756933428120x120.png",
                "vodid": 1
            }
        ],
        "actions": [
            {
                "name": "related",
                "description": "Related"
            },
            {
                "name": "trailer",
                "description": "Trailer"
            },
            {
                "name": "thumbup",
                "description": "Thumb-up"
            },
            {
                "name": "thumbdown",
                "description": "Thumb-down"
            }
        ],
        "watch_mandatory_ad": {
            "get_ads": 0,
            "vast_ad_url": "https://servedbyadbutler.com/vast.spark?setID=5291&ID=173381&pid=57743"
        },
        "vod_stream": {
            "stream_format": "2",
            "drm_platform": "none",
            "url": "https://devapp.magoware.tv/admin/#/tv_episode_stream/create?defaultValues=%7B%22tv_episode_id%22:1%7D",
            "token": false,
            "token_url": "Token Url",
            "encryption": false,
            "encryption_url": "Encryption url"
        },
        "payment_url": "https://devapp.magoware.tv/apiv3/vod_payment/vod_purchase/1/klendi11"
    }
}
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
exports.getEpisodeDetails = async function (req, res) {
  const companyId = req.user.company_id;
  const settings = req.app.locals.backendsettings[companyId];
  const username = req.auth.data.username;
  const lang = languages[req.body.language].language_variables;

  const schema = Joi.object().keys({
    episodeId: Joi.number().integer().required()
  })

  const {error, value} = schema.validate(req.params)

  if (error) {
    return response.sendError(req, res, 400, 60)
  }
  const {episodeId} = value;

  try {

    const attributes = [
      'id', ['adult_content', 'adult'], [sequelize.literal('"tv_episode"'), 'vod_type'], 'homepage', 'budget', 'mandatory_ads', 'imdb_id', 'original_language', 'original_title', 'expiration_time', 'price', 'status',
      'cast', 'director', 'title', ['description', 'overview'], ['duration', 'runtime'], 'vote_count', 'vote_average', 'popularity', 'revenue', 'tagline',
      [db.sequelize.fn("concat", settings.assets_url, db.sequelize.col('image_url')), 'backdrop_path'],
      [db.sequelize.fn("concat", settings.assets_url, db.sequelize.col('tv_episode.icon_url')), 'poster_path'],
      'trailer_url', 'vod_preview_url', 'default_subtitle_id', 'spoken_languages', [sequelize.fn('DATE_FORMAT', sequelize.col('release_date'), '%Y-%m-%d'), 'air_date']
    ];

    const vodJoinList = [
      {
        model: models.tv_episode_stream,
        attributes: ['stream_format', 'drm_platform', ['tv_episode_url', 'url'], 'token', 'token_url', 'encryption', 'encryption_url'],
        where: {
          stream_source_id: req.user.vod_stream_source,
          stream_resolution: {[Op.like]: "%" + req.auth.data.app_id + "%"}
        },
        required: false
      },
      {
        model: models.tv_episode_subtitles,
        attributes: ['id', 'title', [db.sequelize.fn("concat", settings.assets_url, db.sequelize.col('subtitle_url')), 'url'], ['tv_episode_id', 'vodid']]
      },
      {
        model: models.tv_episode_resume,
        attributes: ['resume_position'],
        required: false,
        where: {login_id: req.user.id}
      }
    ];

    const vodResultQuery = await models.tv_episode.findOne({
      attributes: attributes,
      include: vodJoinList,
      where: {
        id: episodeId,
        is_available: true,
        expiration_time: {[Op.gte]: Date.now()},
        company_id: req.user.company_id
      }
    });

    if (!vodResultQuery)
      return response.sendError(req, res, 404, 62)

    let vodResult = vodResultQuery.dataValues;

    let actions = [
      {name: "related", description: lang["RELATED"]},
      {name: "trailer", description: lang["TRAILER"]},
      {name: "thumbup", description: lang["THUMBUP"]},
      {
        name: "thumbdown",
        description: lang["THUMBDOWN"]
      }
    ];
    //return play action for purchased movies, or those part of an active subscription
    delete vodResult.t_vod_sales;

    if (vodResultQuery.tv_episode_subtitles) {
      try {
        var found = vodResultQuery.tv_episode_subtitles.find(function (x) {
          if (x.id === (vodResultQuery.default_subtitle_id)) {
            return x.title;
          }
        }).title;
      } catch (error) {
        var found = "";
      }
    }
    vodResultQuery.default_language = found;

    delete vodResult.tv_series_categories;

    const vod_stream = (vodResult.tv_episode_streams && vodResult.tv_episode_streams[0]) ? vodResult.tv_episode_streams[0] : {};
    delete vod_stream.tv_episode_streams;

    const payment_url = settings.assets_url + "/apiv3/vod_payment/vod_purchase/" + vodResult.id + '/' + username;
    const watch_mandatory_ad = {
      "get_ads": (req.user.get_ads || vodResult.mandatory_ads) ? 1 : 0,
      "vast_ad_url": "https://servedbyadbutler.com/vast.spark?setID=5291&ID=173381&pid=57743"
    };
    delete vodResult.mandatory_ads;
    delete vodResult.season;

    vodResult.vod_subtitles = (vodResult.tv_episode_subtitles) ? vodResult.tv_episode_subtitles : [];
    delete vodResult.tv_episode_subtitles;

    const movie = {
      ...vodResult,
      actions,
      // default_language: defaultLanguage,
      watch_mandatory_ad,
      // vod_resumes,
      vod_stream,
      payment_url
    };

    response.sendData(req, res, movie);
  } catch (e) {
    winston.error("Getting the vod v4 details failed with error: ", e);
    response.sendError(req, res, 500, 51);
  }
}


/**
 * @api {get} /apiv4/vod/search Search Movies
 * @apiVersion 4.0.0
 * @apiName SearchMovies
 * @apiGroup VOD_V4
 *
 * @apiHeader {String} x-access-token Users JWT token.
 * @apiDescription Retrieve movies list.
 * @apiParam {String} [q] Query parameter, the text to be searched.
 * @apiParam {Number} [page] Page (pagination) number. If missing, returns first page.
 * @apiParam {String} [pin_protected]  Unless specified otherwise, return only items that are not pin protected. Value set [true, false]
 * @apiParam {String} [show_adult]  Unless specified otherwise, return only items that are not adult content. Value set [true, false]
 * @apiParam {String} [order_by] Orders items by a specified field. Creation date is the default. Value set is [clicks, rate, vote_average, vote_count, popularity, duration, pin_protected, adult_content, isavailable, expiration_time, price, revenue, budget, release_date]
 * @apiParam {String} [order_dir] Order direction. Descending is default. Value set is [desc, asc]
 *
 *@apiDescription Returns paginated list of movies. Number of items per page is specified in the company settings (30 by default).
 * Expired and non-available movies are not returned. By default, pin protected or adult movies are not returned, unless specified otherwise.
 * Only movies belonging to at least a genre are returned.
 *
 * @apiSuccessExample Success-Response:
 *   HTTP/1.1 200 OK
 {
      "data": {
          "page": 1,
          "total_results": 1,
          "total_pages": 1,
          "results": [
              {
                  "id": 1,
                  "rate": 9,
                  "title": "test",
                  "vod_type": "film",
                  "trailer_url": "https://www.youtube.com/watch?v=O0s5fvRtBOo",
                  "price": 0,
                  "expiration_time": "3017-12-31T23:00:00.000Z",
                  "backdrop_path": "https://devapp.magoware.tv/1/files/vod/1590760020221120x120.png",
                  "poster_path": "https://devapp.magoware.tv/1/files/vod/1590760004290120x120.png",
                  "original_language": "en",
                  "original_title": "te",
                  "adult": 0,
                  "overview": "tt",
                  "release_date": "1896-12-28",
                  "pin_protected": 0
              }
          ]
      }
}
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
exports.searchTvShows = async function (req, res) {
  const companyId = req.user.company_id;
  const settings = req.app.locals.backendsettings[companyId];
  const pageLength = settings.vod_subset_nr ? settings.vod_subset_nr : 30;

  const schema = Joi.object().keys({
    page: Joi.number().integer().default(1),
    pin_protected: Joi.boolean().default(true),
    adult_content: Joi.boolean().default(false),
    order_dir: Joi.string().valid('ASC', 'DESC', 'asc', 'desc').default('DESC'),
    order_by: Joi.string().default("createdAt"),
    q: Joi.string().required()
  });

  const {error, value} = schema.validate(req.query);
  const {page, pin_protected, adult_content, order_by, order_dir, q: text} = value;

  if (error) {
    return response.sendError(req, res, 400, 60)
  }

  const attributes = [
    'id', 'rate', 'title', [sequelize.literal('"tv_series"'), 'vod_type'], 'trailer_url', 'price', 'expiration_time',
    [db.sequelize.fn("concat", settings.assets_url, db.sequelize.col('tv_series.image_url')), 'backdrop_path'],
    [db.sequelize.fn("concat", settings.assets_url, db.sequelize.col('tv_series.icon_url')), 'poster_path'],
    'original_language', 'original_title', ['adult_content', 'adult'], ['description', 'overview'], [sequelize.fn('DATE_FORMAT', sequelize.col('tv_series.release_date'), '%Y-%m-%d'), 'release_date'], 'pin_protected'
  ];

  const like = {[Op.like]: sqlstring.format("?", ["%" + text.trim() + "%"]).replace(new RegExp("'", 'g'), "")};

  const whereConditions = {
    is_available: true,
    company_id: companyId,
    expiration_time: {[Op.gte]: Date.now()},
    pin_protected: pin_protected ? {[Op.in]: [true, false]} : false,
    adult_content: adult_content ? {[Op.in]: [true, false]} : false,
    [Op.or]: {
      title: like,
      original_title: like,
      description: like
    },
  }

  try {
    const packages = await models.package.findAll({
      attributes: ['id'],
      where: {package_type_id: req.auth.data.screensize + 2},
      include: [{
        model: models.subscription,
        required: true,
        attributes: ['id'],
        where: {login_id: req.user.id, end_date: {[Op.gte]: Date.now()}}
      }]
    });

    const package_list = packages.map(pkg => pkg.id);
    let include = [
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
            where: {login_id: req.user.id},
            attributes: ['updatedAt']
          }]
        }]
      },
      {model: models.tv_series_packages, required: false, attributes: ['id'], where: {package_id: {[Op.in]: package_list}}}
    ];

    const final = {
      attributes,
      where: whereConditions,
      subQuery: false,
      distinct: true,
      offset: (page - 1) * pageLength,
      limit: pageLength,
      order: [[order_by, order_dir]],
      include
    }

    const results = await models.tv_series.findAndCountAll(final);

    let tv_show_list = [];
    const transactional_vod_duration = settings.t_vod_duration;
    await async.forEach(results.rows, function (tv_show, callback) {
      tv_show = tv_show.toJSON();

      const subscription_list = !!(tv_show.tv_series_packages && tv_show.tv_series_packages.length > 0);
      const purchased = !!(tv_show.t_tv_series_sales && tv_show.t_tv_series_sales.length > 0);
      const available_for_purchase = !!(tv_show.price > 0 && transactional_vod_duration && (moment(tv_show.expiration_time) > moment().add(transactional_vod_duration, 'day')));

      if (subscription_list || purchased || available_for_purchase) {
        delete tv_show.season;
        delete tv_show.createdAt;
        delete tv_show.t_tv_series_sales;
        delete tv_show.tv_series_packages;

        tv_show_list.push(tv_show); //load the tv show object in the response data
        callback(null);
      } else callback(null);
    }, function (error, result) {
      if (error) throw new Error(error);
      const vod_list = {
        page: page, //page number
        total_results: results.count, //number of vod items in total for this user. This is a maximum bound, not the exact number
        total_pages: Math.ceil(results.count / pageLength), //number of pages for this user. This is a maximum bound, not the exact number
        results: tv_show_list //return found records
      };
      res.setHeader("X-Total-Count", results.count);
      response.sendData(req, res, vod_list);
    });
  } catch (error) {
    winston.error("Getting the vod v4 list failed with error: ", error);
    response.sendError(req, res, 500, 51);
  }
}