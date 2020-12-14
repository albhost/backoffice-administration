'use strict';

/**
 * Module dependencies.
 */
var path = require('path'),
    errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller')),
    logHandler = require(path.resolve('./modules/mago/server/controllers/logs.server.controller')),
    db = require(path.resolve('./config/lib/sequelize')).models,
    sequelize_t = require(path.resolve('./config/lib/sequelize')),
    DBModel = db.vod,
    querstring = require('querystring'),
    fs = require('fs'),
    winston = require(path.resolve('./config/lib/winston')),
    saas_functions = require(path.resolve('./custom_functions/saas_functions'));
const download = require('download');
const axios = require('axios').default;
const { Op } = require('sequelize');
const { getStorage } = require('../../../../config/lib/storage_manager');
const { downloadToStorage } = require('../../../../custom_functions/storage');

function link_vod_with_genres(vod_id,array_category_ids, db_model, company_id) {
    var transactions_array = [];
    //todo: references must be updated to non-available, not deleted
    return db_model.update(
        {
            is_available: false
        },
        {
            where: {
                vod_id: vod_id,
                category_id: {[Op.notIn]: array_category_ids},
                company_id: company_id
            }
        }
    ).then(function (result) {
        return sequelize_t.sequelize.transaction(function (t) {
            for (var i = 0; i < array_category_ids.length; i++) {
                transactions_array.push(
                    db_model.upsert({
                        vod_id: vod_id,
                        category_id: array_category_ids[i],
                        is_available: true,
                        company_id: company_id,
                    }, {transaction: t}).catch(function(error){
                        winston.error(error);
                    })
                )
            }
            return Promise.all(transactions_array, {transaction: t}); //execute transaction
        }).then(function (result) {
            return {status: true, message:'transaction executed correctly'};
        }).catch(function (err) {
            winston.error("Error at link vod with genres, error: ",err);
            return {status: false, message:'error executing transaction'};
        })
    }).catch(function (err) {
        winston.error("Error at deleting existing packages, error: ", err);
        return {status: false, message:'error deleting existing packages'};
    })
}

function link_vod_with_packages(item_id, data_array, model_instance, company_id) {
    var transactions_array = [];
    var destroy_where = (data_array.length > 0) ? {
        vod_id: item_id,
        package_id: {[Op.notIn]: data_array},
        company_id: company_id
    } : {
        vod_id: item_id,
        company_id: company_id
    };

    return model_instance.destroy({
        where: destroy_where
    }).then(function (result) {
        return sequelize_t.sequelize.transaction(function (t) {
            for (var i = 0; i < data_array.length; i++) {
                transactions_array.push(
                    model_instance.upsert({
                        vod_id: item_id,
                        package_id: data_array[i],
                        company_id: company_id
                    }, {transaction: t})
                )
            }
            return Promise.all(transactions_array, {transaction: t}); //execute transaction
        }).then(function (result) {
            return {status: true, message:'transaction executed correctly'};
        }).catch(function (err) {
            winston.error("Error at linking vod with packages, error: ",err);
            return {status: false, message:'error executing transaction'};
        })
    }).catch(function (err) {
        winston.error(err);
        return {status: false, message:'error deleteting existing packages'};
    })
}

/**
 * Create
 */
exports.create = async (req, res) => {
    if(!req.body.clicks) req.body.clicks = 0;
    if(!req.body.duration) req.body.duration = 0;
    if (!req.body.original_title) req.body.original_title = req.body.title;

    var array_vod_vod_categories = req.body.vod_vod_categories || [];
    delete req.body.vod_vod_categories;

    var array_package_vod = req.body.package_vods || [];
    delete req.body.package_vods;

    req.body.company_id = req.token.company_id; //save record for this company
    var limit = req.app.locals.backendsettings[req.token.company_id].asset_limitations.vod_limit;

    try {
        let storage = await getStorage(req.token.company_id);

        if(!req.body.icon_url.startsWith("/files/vod/")) {
            var origin_url_icon_url = 'https://image.tmdb.org/t/p/w500'+req.body.icon_url;
            var destination_path_icon_url = "files/vod";
            var vod_filename_icon_url = req.body.icon_url; //get name of new file
            
            try {
                await downloadToStorage(origin_url_icon_url, storage, destination_path_icon_url + vod_filename_icon_url);
                winston.info("Success downloading tmdb image");
            } catch (error) {
                winston.error("Error downloading tmdb image ", error);
            }
            // delete req.body.poster_path;
            req.body.icon_url = '/files/vod'+vod_filename_icon_url;
        }
    
        if(!req.body.image_url.startsWith("/files/vod/")) {
            var origin_url_image_url = 'https://image.tmdb.org/t/p/original'+req.body.image_url;
            var destination_path_image_url = "files/vod";
            var vod_filename_image_url = req.body.image_url; //get name of new file
            
            try {
                await downloadToStorage(origin_url_image_url, storage, destination_path_image_url + vod_filename_image_url);
                winston.info("Success downloading tmdb image");
            } catch (error) {
                winston.error("Error downloading tmdb image ", error);
            }
            // delete req.body.backdrop_path;
            req.body.image_url = '/files/vod'+vod_filename_image_url;
        }
    }
    catch(err) {
        winston.error("Failed accessing storage ", err);
    }

    saas_functions.check_limit('vod', req.token.company_id, limit).then(function(limit_reached){
        if(limit_reached === true) return res.status(400).send({message: "You have reached the limit number of vod items you can create for this plan. "});
        else{
            DBModel.create(req.body).then(function(result) {
                if (!result) {
                    return res.status(400).send({message: 'fail create data'});
                } else {
                    logHandler.add_log(req.token.id, req.ip.replace('::ffff:', ''), 'created', JSON.stringify(req.body));
                    return link_vod_with_genres(result.id,array_vod_vod_categories, db.vod_vod_categories, req.token.company_id).then(function(t_result) {
                        if (t_result.status) {
                            return link_vod_with_packages(result.id, array_package_vod, db.package_vod, req.token.company_id).then(function(t_result) {
                                if (t_result.status) {
                                    return res.jsonp(result);
                                }
                                else {
                                    return res.send(t_result);
                                }
                            })
                        }
                        else {
                            return res.send(t_result);
                        }
                    })
                }
            }).catch(function(err) {
                winston.error("Error at creating vod, error: ",err);
                return res.status(400).send({
                    message: errorHandler.getErrorMessage(err)
                });
            });
        }
    }).catch(function(error){
        winston.error("Error checking for the limit number of vod items for company with id ",req.token.company_id," - ", error);
        return res.status(400).send({message: "The limit number of vod items you can create for this plan could not be verified. Check your log file for more information."});
    });
};

/**
 * Show current
 */
exports.read = async (req, res) => {
  const id = req.params.tmdbId
  if (!(id % 1 === 0)) { //check if it's integer
    return res.status(404).send({ message: 'Data is invalid' });
  }

  const options = {
    method: 'GET',
    url: `https://api.themoviedb.org/3/movie/${id}?` + querstring.stringify({
      language: 'en-US',
      api_key: 'fe4104e791060715f23f1244a51b926a',
      append_to_response: 'credits,videos'
    })
  };
  try {
    let response = await axios(options);
    var b;
    var starring_array = '';
    for (b = 0; b < response.data.credits.cast.length; b++) {
      starring_array += response.data.credits.cast[b].name + ',';
    }
    //./get all starring/cast from tmdb

    //get director from tmdb
    var c;
    var director_array = '';
    for (c = 0; c < response.data.credits.crew.length; c++) {

      if (response.data.credits.crew[c].job === 'Director')
        director_array += response.data.credits.crew[c].name;
    }
    //./get director from tmdb

    //get trailer url
    if (response.data.videos.results.length > 0) {
      response.data.trailer_url = 'https://www.youtube.com/watch?v=' + response.data.videos.results[0].key;
    } else {
      response.data.trailer_url = '';
    }
    //./get trailer url

    response.data.description = response.data.overview; delete response.data.overview;
    response.data.duration = response.data.runtime; delete response.data.runtime;
    response.data.adult_content = response.data.adult; delete response.data.adult;
    response.data.icon_url = response.data.poster_path; delete response.data.poster_path;
    response.data.image_url = response.data.backdrop_path; delete response.data.backdrop_path;
    response.data.starring = starring_array; delete response.data.credits;
    response.data.director = director_array;

    res.send(response.data);
  } catch (error) {
    winston.error("There has been an error getting tmdb of movie, check tmdb token", error);
    return res.status(500).send({
      status: 500,
      message: "There has been an error getting tmbd of movie, check tmbd token"
    });
  }
};


exports.list = async (req, res) => {
  let query = req.query;
  let page = query.page || 1;

  if (!query.q) {
      res.json([]);
      return;
  }

  if (parseInt(query._start)) page = parseInt(query._start);

  const options = {
    method: 'GET',
    url: 'https://api.themoviedb.org/3/search/movie?' + querstring.stringify({
      page: page,
      query: query.q,
      api_key: 'fe4104e791060715f23f1244a51b926a',
      language: "en-US"
    })
  };
  try {
    let response = await axios(options)
    res.send(response.data.results);
  } catch (error) {
    winston.error("There has been an error getting tmdb list of movies, check tmdb token", error);
    return res.status(500).send({
      status: 500,
      message: "There has been an error getting tmbd list of movies, check tmbd token"
    });
  }
};
