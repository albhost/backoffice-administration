'use strict'

const path = require('path'),
  db = require(path.resolve('./config/lib/sequelize')),
  models = db.models,
  response = require('../utils/response'),
  winston = require('winston'),
  sequelize_instance = require(path.resolve('./config/lib/sequelize')),
  sequelize = require('sequelize');

const Joi = require("joi");
const getMovieTMDbId = require("../utils/getMovieTMDbId");
const moment = require("moment");
const sqlstring = require("sqlstring");
const { Op } = require("sequelize");



/**
 * @api {get} /apiv4/vod/list Get Vod List
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
exports.getVodList = async function (req, res) {
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
    'id', 'rate', 'title', [sequelize.literal('"film"'), 'vod_type'], 'trailer_url', 'price', 'expiration_time',
    [db.sequelize.fn("concat", settings.assets_url, db.sequelize.col('image_url')), 'backdrop_path'],
    [db.sequelize.fn("concat", settings.assets_url, db.sequelize.col('vod.icon_url')), 'poster_path'],
    'original_language', 'original_title', ['adult_content', 'adult'], ['description', 'overview'], [sequelize.fn('DATE_FORMAT', sequelize.col('release_date'), '%Y-%m-%d'), 'release_date'], 'pin_protected'
  ];

  const whereConditions = {
    isavailable: true,
    company_id: companyId,
    expiration_time: {[Op.gte]: Date.now()},
    pin_protected: pin_protected ? {[Op.in]: [true, false]} : false,
    adult_content: adult_content ? {[Op.in]: [true, false]} : false,
  }

  const vod_vod_category_filter = (category_id) ? {category_id: category_id} : {vod_id: {[Op.gt]: 0}};
  const vod_category_filter = {password: pin_protected ? {[Op.in]: [true, false]} : false}

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
      {
        model: models.vod_vod_categories, required: true, attributes: [], where: vod_vod_category_filter,
        include: [{model: models.vod_category, attributes: [], where: vod_category_filter}]
      },
      {model: models.package_vod, required: true, attributes: [], where: {package_id: {[Op.in]: package_list}}},
      {model: models.vod_stream, required: true, attributes: [], where: {
          stream_resolution: {[Op.like]: `%${req.auth.data.app_id}%`},
          stream_source_id: req.user.vod_stream_source,
      }}

    ];

    const final = {
      attributes,
      where: whereConditions,
      subQuery: false,
      distinct: true,
      offset: (page - 1) * pageLength,
      limit: pageLength,
      order: [[order_by, order_dir]],
      group: "vod.id",
      include
    }

    const results = await models.vod.findAndCountAll(final);

    const vod_list = {
      page: page, //page number
      total_results: results.count.length, //number of vod items in total for this user. This is a maximum bound, not the exact number
      total_pages: Math.ceil(results.count.length / pageLength), //number of pages for this user. This is a maximum bound, not the exact number
      results: results.rows //return found records
    };

    res.setHeader("X-Total-Count", results.count.length);
    response.sendData(req, res, vod_list);

  } catch (error) {
    winston.error("Getting the vod v4 list failed with error: ", error);
    response.sendError(req, res, 500, 51);
  }
};

/**
 * @api {get} /apiv4/vod/menu Get Vod Menu
 * @apiVersion 4.0.0
 * @apiName GetVodMenu
 * @apiGroup VOD_V4
 *
 * @apiHeader {String} x-access-token Users JWT token.
 * @apiDescription Retrieve the vod menu.
 * @apiParam {Number} [page] Page (pagination) number. If missing, returns first page.
 * @apiParam {String} [show_adult]  Unless specified otherwise, return only items that are not adult content. Value set [true, false]
 *
 *@apiDescription Returns paginated list of movies. Number of items per page is specified in the company settings (30 by default).
 * Expired and non-available movies are not returned. By default, pin protected or adult movies are not returned, unless specified otherwise.
 * Only movies belonging to at least a genre are returned.
 *
 * @apiSuccessExample Success-Response:
 *   HTTP/1.1 200 OK
 {
    "data": [
        {
            "id": 1,
            "name": "TV SHOWS 1",
            "description": "231",
            "order": 1,
            "pin_protected": 0,
            "is_adult": false,
            "is_available": 1,
            "icon_url": "https://devapp.magoware.tv/1/TopChannel.png",
            "vod_menu_carousels": [
                {
                    "id": 1,
                    "name": "Pin Movies",
                    "description": "2",
                    "order": 1,
                    "url": "/apiv3/tv_show/tv_show_list?category_id=1&pin_protected=false&adult_content=false&order_by=createdAt&order_dir=desc",
                    "is_available": 1
                }
            ]
        }
    ]
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
exports.getVodMenu = async function (req, res) {
  const companyId = req.user.company_id;
  const settings = req.app.locals.backendsettings[companyId];
  const showAdultParamNotNull = req.query.show_adult !== undefined
  const showAdultParam = req.query.show_adult === "true"
  const showAdult = req.user.show_adult;

  const whereConditions = {
    isavailable: true,
    company_id: companyId,
    is_adult: false
  }

  if ((showAdultParamNotNull && !showAdultParam) || (!showAdultParamNotNull && !showAdult)) {
    whereConditions.pin_protected = 0;
  } else if (!showAdultParamNotNull && showAdult) {
    whereConditions.is_adult = {[Op.in]: [true, false]};
  } else {
    whereConditions.is_adult = {[Op.in]: [true, false]};
  }

  try {
    const vodMenu = await models.vod_menu.findAll({
      attributes: ['id', 'name', 'description', 'order', 'pin_protected', 'is_adult', ['isavailable', 'is_available'],
        [db.sequelize.fn('concat', settings.assets_url, db.sequelize.col('icon_url')), 'icon_url']
      ],
      include: [{
        model: models.vod_menu_carousel,
        attributes: ['id', 'name', 'description', 'order', 'url', ['isavailable', 'is_available']],
        required: false,
        where: {company_id: companyId, isavailable: true}
      }],
      order: [
        [models.vod_menu_carousel, 'order', 'ASC'],
        ['order', 'ASC']
      ],
      where: whereConditions
    });

    response.sendData(req, res, vodMenu);

  } catch (e) {
    winston.error("Getting list of vod menu v4 failed with error: ", e);
    response.sendError(req, res, 500, 51);
  }

}

/**
 * @api {get} /apiv4/vod/details/:vodId Get Movie Details
 * @apiVersion 4.0.0
 * @apiName GetMovieDetails
 * @apiGroup VOD_V4
 *
 * @apiHeader {String} x-access-token Users JWT token.
 * @apiDescription Retrieve the movie details.
 * @apiParam {Integer} vodId The id of movie.
 *
 *@apiDescription Returns information about a vod item, such as production info, subtitles and stream. Validation (expiration, pin protection etc) should be done in a previous request
 *
 * @apiSuccessExample Success-Response:
 *   HTTP/1.1 200 OK
 {
    "data": {
        "id": 1,
        "adult": 0,
        "homepage": "",
        "budget": 0,
        "imdb_id": "0",
        "original_language": "en",
        "original_title": "te",
        "expiration_time": "3017-12-31T23:00:00.000Z",
        "price": 0,
        "cast": "tt",
        "director": "john lindt",
        "release_year": 1896,
        "vod_type": "film",
        "backdrop_path": "https://devapp.magoware.tv/1/files/vod/1590760020221120x120.png",
        "poster_path": "https://devapp.magoware.tv/1/files/vod/1590760004290120x120.png",
        "overview": "tt",
        "popularity": 0,
        "revenue": 0,
        "runtime": 100,
        "vote_count": 0,
        "trailer_url": "https://www.youtube.com/watch?v=O0s5fvRtBOo",
        "vod_preview_url": "/1/files/video_scrubbing_url/1590760001407120x120.png",
        "release_date": "1896-12-28",
        "spoken_languages": "null",
        "status": "released",
        "tagline": "test",
        "title": "test",
        "vote_average": 5,
        "pin_protected": 0,
        "vod_subtitles": [],
        "vod_resumes": {
            "resume_position": 0,
            "reaction": 0
        },
        "dataValues": {
            "tmdb_values": {
                "tmdbId": -1
            }
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
        "vod_stream": {
            "stream_format": "0",
            "drm_platform": "none",
            "url": "https://dl.opensubtitles.org/en/download/src-api/vrf-19bd0c55/sid-,eq2E8JzvIzWOef5hBpuBTn6apf/file/1955265272",
            "token": false,
            "token_url": "Token Url",
            "encryption": false,
            "encryption_url": "Encryption url",
            "stream_type": "regular",
            "thumbnail_url": null
        },
        "payment_url": "https://devapp.magoware.tv/apiv3/vod_payment/vod_purchase/1/iris"
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
exports.getMovieDetails = async function (req, res) {
  const companyId = req.user.company_id;
  const settings = req.app.locals.backendsettings[companyId];
  const userId = req.user.id;
  const username = req.auth.data.username;
  const appId = req.auth.data.app_id;
  const lang = languages[req.body.language].language_variables;

  const schema = Joi.object().keys({
    vodId: Joi.number().integer().required()
  })

  const {error, value} = schema.validate(req.params)

  if (error) {
    return response.sendError(req, res, 400, 60)
  }
  const {vodId} = value;

  try {
    const transactionalVodDuration = settings.t_vod_duration;
    const attributes = [
      'id', ['adult_content', 'adult'], 'homepage', 'budget', 'mandatory_ads', 'imdb_id', 'original_language', 'original_title', 'expiration_time', 'price',
      ['starring', 'cast'], 'director', [db.sequelize.fn('YEAR', db.sequelize.col('release_date')), "release_year"], [sequelize.literal('"film"'), 'vod_type'],
      [db.sequelize.fn("concat", settings.assets_url, db.sequelize.col('image_url')), 'backdrop_path'],
      [db.sequelize.fn("concat", settings.assets_url, db.sequelize.col('vod.icon_url')), 'poster_path'],
      ['description', 'overview'], 'popularity', 'revenue', ['duration', 'runtime'], 'vote_count', 'trailer_url', 'vod_preview_url', 'default_subtitle_id',
      [sequelize.fn('DATE_FORMAT', sequelize.col('release_date'), '%Y-%m-%d'), 'release_date'], 'spoken_languages', 'status', 'tagline', 'title', 'vote_average', 'pin_protected'
    ];
    const vodJoinList = [
      {
        model: models.vod_stream,
        attributes: ['stream_format', 'drm_platform', 'url', 'token', 'token_url', 'encryption', 'encryption_url', 'stream_type', 'thumbnail_url'],
        required: false,
        where: {
          stream_source_id: req.user.vod_stream_source,
          stream_resolution: {[Op.like]: "%" + appId + "%"}
        }
      },
      {
        model: models.vod_subtitles, required: false,
        attributes: ['id', 'title', [db.sequelize.fn("concat", settings.assets_url, db.sequelize.col('subtitle_url')), 'url'], ['vod_id', 'vodid']]
      },
      {
        model: models.vod_vod_categories,
        attributes: ['id'],
        include: [{model: models.vod_category, attributes: ['id', 'name'], required: false}]
      },
      {
        model: models.t_vod_sales,
        attributes: ['id'],
        required: false,
        where: {login_data_id: userId, vod_id: vodId, end_time: {[Op.gte]: Date.now()}}
      },
      {
        model: models.vod_resume,
        attributes: ['resume_position', 'reaction', 'vod_type', 'favorite', 'percentage_position', 'favorite'],
        required: false,
        where: {login_id: req.user.id}
      }
    ];
    const subscriptionJoinList = [
      {
        model: models.package,
        attributes: ['id'],
        required: true,
        where: {package_type_id: req.auth.data.screen_size + 2},
        include: [
          {model: models.package_vod, attributes: ['id'], where: {vod_id: vodId}, required: true}
        ]
      }
    ];

    const vodResultQuery = await models.vod.findOne({
      attributes: attributes,
      include: vodJoinList,
      where: {id: vodId, isavailable: true, expiration_time: {[Op.gte]: Date.now()}}
    });

    if (!vodResultQuery)
      return response.sendError(req, res, 404, 62)

    let vodResult = vodResultQuery.dataValues;

    let getTMBDid = await getMovieTMDbId(vodResult.original_title || vodResult.title);
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
      where: {login_id: userId, vod_id: vodId},
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
    for (let i = 0; i < vodResult.vod_vod_categories.length; i++)
      genres.push({
        "id": vodResult.vod_vod_categories[i].vod_category.id,
        "name": vodResult.vod_vod_categories[i].vod_category.name
      });

    delete vodResult.vod_vod_categories;
    const vod_stream = (vodResult.vod_streams && vodResult.vod_streams[0]) ? vodResult.vod_streams[0] : {};
    delete vodResult.vod_streams;
    const payment_url = settings.assets_url + "/apiv3/vod_payment/vod_purchase/" + vodResult.id + '/' + username;
    const watch_mandatory_ad = {
      "get_ads": (req.user.get_ads || vodResult.mandatory_ads) ? 1 : 0,
      "vast_ad_url": "https://servedbyadbutler.com/vast.spark?setID=5291&ID=173381&pid=57743"
    };
    delete vodResult.mandatory_ads;
    let vod_resumes;
    if (vodResult.vod_resumes.length < 1)
      vod_resumes = {
        "resume_position": 0,
        "reaction": 0
      };
    else vod_resumes = vodResult.vod_resumes[0];

    const movie = {
      ...vodResult,
      actions,
      reaction,
      default_language: defaultLanguage,
      watch_mandatory_ad,
      vod_resumes,
      genres,
      vod_stream,
      payment_url
    }
    response.sendData(req, res, movie);
  } catch (e) {
    winston.error("Getting the vod v4 details failed with error: ", e);
    response.sendError(req, res, 500, 51);
  }
}

/**
 * @api {get} /apiv4/vod/related/:vodId Get Related Movies
 * @apiVersion 4.0.0
 * @apiName GetVodRelatedList
 * @apiGroup VOD_V4
 *
 * @apiHeader {String} x-access-token Users JWT token.
 * @apiDescription Retrieve related movies list to a film.
 * @apiParam {Number} [page] Page (pagination) number. If missing, returns first page.
 * @apiParam {String} [pin_protected]  Unless specified otherwise, return only items that are not pin protected. Value set [true, false]
 * @apiParam {Integer} vodId The id of movie.

 * @apiDescription Returns paginated list of movies. Number of items per page is specified in the company settings (30 by default).
 * Expired and non-available movies are not returned. By default, pin protected or adult movies are not returned, unless specified otherwise.
 * Only movies belonging to at least a genre are returned.
 *
 * @apiSuccessExample Success-Response:
 *   HTTP/1.1 200 OK
 {
    "data": [
        {
            "id": 2,
            "vote_count": 0,
            "vote_average": 5,
            "title": "Thor",
            "popularity": 0,
            "original_language": "en",
            "original_title": "Avengers: Endgame",
            "adult": 0,
            "overview": "213",
            "vod_type": "film",
            "trailer_url": "https://www.youtube.com/watch?v=TTRe-zSbEUY",
            "backdrop_path": "https://devapp.magoware.tv/1/files/vod/16008703833701600350382998240pxApplelogo.png",
            "poster_path": "https://devapp.magoware.tv/1/files/vod/1600870380761pbw4xd7kofo51.jpg",
            "release_date": "1896-12-28",
            "matching_score": 1
        }
    ]
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
exports.getRelatedMovies = async function (req, res) {
  const companyId = req.user.company_id;
  try {

    const settings = req.app.locals.backendsettings[companyId];
    const userId = req.user.id;
    const screenSize = req.auth.data.screensize;

    const pageLength = (settings.vod_subset_nr) ? settings.vod_subset_nr : 30;
    const vodId = parseInt(req.params.vodId);

    const schema = Joi.object().keys({
      page: Joi.number().integer().default(1),
      pin_protected: Joi.boolean().default(false)
    });

    const {error, value} = schema.validate(req.query);
    const {page, pin_protected} = value;

    if (error || !vodId) {
      return response.sendError(req, res, 400, 60)
    }

    const packagesWithSubscription = await models.package.findAll({
      attributes: ['id'],
      where: {package_type_id: screenSize + 2},
      include: [{
        model: models.subscription,
        required: true,
        attributes: ['id'],
        where: {login_id: userId, end_date: {[Op.gte]: Date.now()}}
      }]
    })

    const movieResult = await models.vod.findAll({
      attributes: ['director', 'starring', [sequelize.literal('"film"'), 'vod_type']],
      include: [{
        model: models.vod_vod_categories, attributes: ['category_id'], where: {is_available: true}
      }],
      where: {id: vodId, company_id: companyId},
      limit: 1
    })

    if (!movieResult) return response.sendError(req, res, 404, 62);

    const director_list = movieResult[0].director.split(',');
    let director_matching_score = "";
    for (let i = 0; i < director_list.length; i++) {
      if (i === director_list.length - 1) director_matching_score += sqlstring.format(" IF( ( director like '%??%' ), 0.5, 0)", [director_list[i].trim().replace(new RegExp("'", 'g'), " ")]);
      else director_matching_score += sqlstring.format(" IF( ( director like '%??%' ), 0.5, 0) + ", [director_list[i].trim().replace(new RegExp("'", 'g'), " ")]);
    }

    const actor_list = movieResult[0].starring.split(',');
    let actor_matching_score = "";
    for (let j = 0; j < actor_list.length; j++) {
      if (j === actor_list.length - 1) actor_matching_score += sqlstring.format("IF( ( starring like '%??%' ), 0.3, 0)", [actor_list[j].trim().replace(new RegExp("'", 'g'), " ")]);
      else actor_matching_score += sqlstring.format("IF( ( starring like '%??%' ), 0.3, 0) + ", [actor_list[j].trim().replace(new RegExp("'", 'g'), " ")]);
    }

    const genresList = movieResult[0].vod_vod_categories;

    let genresMatchingScore = "";
    for (let k = 0; k < genresList.length; k++) {
      if (k === genresList.length - 1) genresMatchingScore += sqlstring.format("IF( ( vod_vod_categories.category_id = ? ), 1, 0)", [genresList[k].category_id]);
      else genresMatchingScore += sqlstring.format("IF( ( vod_vod_categories.category_id = ? ), 1, 0) + ", [genresList[k].category_id])
    }

    let packages = [];
    for (let i = 0; i < packagesWithSubscription.length; i++) {
      packages.push(packagesWithSubscription[i].id);
    }

    let whereConditionQuery = `vod.id <> ${vodId} AND vod.company_id = ${companyId} AND vod.isavailable = true`;
    whereConditionQuery += ` AND package_vod.package_id IN (${packages.join()}) AND expiration_time > NOW()`

    if (!pin_protected) whereConditionQuery += ` AND adult_content = false `;

    let finalQuery = `SELECT DISTINCT vod.id, vod.vote_count, vod.vote_average, vod.title, vod.popularity, vod.original_language, vod.original_title, vod.adult_content as adult, vod.description as overview, 'film' as vod_type,
     vod.trailer_url, concat(${sqlstring.escape(settings.assets_url)}, vod.image_url) as backdrop_path,
     concat(${sqlstring.escape(settings.assets_url)}, vod.icon_url) as poster_path,
     DATE_FORMAT(vod.release_date, '%Y-%m-%d') as release_date, ( `

    if (genresMatchingScore && genresMatchingScore !== "")
      finalQuery += " ( " + genresMatchingScore + " ) + "; //genres matching score

    if (director_matching_score && director_matching_score !== "")
      finalQuery += " ( " + director_matching_score + " ) + "; //director matching score

    if (actor_matching_score && actor_matching_score !== "")
      finalQuery += " ( " + actor_matching_score + " ) ";

    const offset = (page - 1) * pageLength;

    finalQuery += `) AS matching_score 
     FROM vod 
     INNER JOIN vod_vod_categories ON vod.id = vod_vod_categories.vod_id 
     INNER JOIN vod_category ON vod_vod_categories.category_id = vod_category.id
     INNER JOIN package_vod ON vod.id = package_vod.vod_id
     WHERE ${whereConditionQuery} 
     GROUP BY vod.id
     ORDER BY  matching_score DESC
     LIMIT ${offset}, ${pageLength};`

    const finalResult = await sequelize_instance.sequelize.query(finalQuery);

    if (!finalResult || !finalResult[0])
      response.sendError(req, res, 500, 51);

    const data = finalResult[0];

    response.sendData(req, res, data);
  } catch (e) {
    winston.error("Getting the vod v4 related list failed with error: ", e);
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
exports.searchMovies = async function (req, res) {
  const companyId = req.user.company_id;
  const settings = req.app.locals.backendsettings[companyId];
  const pageLength = settings.vod_subset_nr ? settings.vod_subset_nr : 30;

  const schema = Joi.object().keys({
    page: Joi.number().integer().default(1),
    pin_protected: Joi.boolean().default(false),
    show_adult: Joi.boolean().default(false),
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
    'id', 'rate', 'title', [sequelize.literal('"film"'), 'vod_type'], 'trailer_url', 'price', 'expiration_time',
    [db.sequelize.fn("concat", settings.assets_url, db.sequelize.col('image_url')), 'backdrop_path'],
    [db.sequelize.fn("concat", settings.assets_url, db.sequelize.col('vod.icon_url')), 'poster_path'],
    'original_language', 'original_title', ['adult_content', 'adult'], ['description', 'overview'], [sequelize.fn('DATE_FORMAT', sequelize.col('release_date'), '%Y-%m-%d'), 'release_date'], 'pin_protected'
  ];

  const like = {[Op.like]: sqlstring.format("?", ["%" + text.trim() + "%"]).replace(new RegExp("'", 'g'), "")};

  const whereConditions = {
    isavailable: true,
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
      {model: models.package_vod, required: true, attributes: [], where: {package_id: {[Op.in]: package_list}}}
    ];

    const final = {
      attributes,
      where: whereConditions,
      subQuery: false,
      distinct: true,
      offset: (page - 1) * pageLength,
      limit: pageLength,
      order: [[order_by, order_dir]],
      group: "vod.id",
      include
    }

    const results = await models.vod.findAndCountAll(final);

    const vod_list = {
      page: page, //page number
      total_results: results.count.length, //number of vod items in total for this user. This is a maximum bound, not the exact number
      total_pages: Math.ceil(results.count.length / pageLength), //number of pages for this user. This is a maximum bound, not the exact number
      results: results.rows //return found records
    };

    res.setHeader("X-Total-Count", results.count.length);
    response.sendData(req, res, vod_list);
  } catch (error) {
    winston.error("Getting the vod v4 list failed with error: ", error);
    response.sendError(req, res, 500, 51);
  }
}