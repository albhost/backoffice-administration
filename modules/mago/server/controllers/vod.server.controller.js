'use strict';
var winston = require("winston");

/**
 * Module dependencies.
 */
var path = require('path'),
    errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller')),
    logHandler = require(path.resolve('./modules/mago/server/controllers/logs.server.controller')),
    saas_functions = require(path.resolve('./custom_functions/saas_functions')),
    db = require(path.resolve('./config/lib/sequelize')).models,
    sequelize = require('sequelize'),
    sequelize_t = require(path.resolve('./config/lib/sequelize')),
    DBModel = db.vod,
    fs = require('fs'),
    escape = require(path.resolve('./custom_functions/escape'));
const axios = require('axios').default;
const { Op } = require('sequelize');
const Joi = require("joi");


function link_vod_with_genres(vod_id,array_category_ids, db_model, company_id) {
    let transactions_array = [];
    const destroy_where = (array_category_ids.length > 0) ? {
        vod_id: vod_id,
        category_id: {[Op.notIn]: array_category_ids},
        company_id: company_id
    } : {
        vod_id: vod_id,
        company_id: company_id
    };

    return db_model.destroy({where: destroy_where})
      .then(function (result) {
        return sequelize_t.sequelize.transaction(function (t) {
            for (var i = 0; i < array_category_ids.length; i++) {
                transactions_array.push(
                    db_model.upsert({
                        vod_id: vod_id,
                        category_id: array_category_ids[i],
                        company_id: company_id,
                        is_available: true
                    }, {transaction: t}).catch(function(error){
                        winston.error("Error at executing transaction, error: ",error)
                    })
                )
            }
            return Promise.all(transactions_array, {transaction: t}); //execute transaction
        }).then(function (result) {
            return {status: true, message:'transaction executed correctly'};
        }).catch(function (err) {
            winston.error("Error executing transaction, error: ", err);
            return {status: false, message:'error executing transaction'};
        })
    }).catch(function (err) {
        winston.error("Error deleting existing packages at vod, error: ",err);
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
            winston.error("Error at executing transaction at vod, error: ",err);
            return {status: false, message:'error executing transaction'};
        })
    }).catch(function (err) {
        winston.error("Error at deleting existing packages, vod, error: ", err);
        return {status: false, message:'error deleting existing packages'};
    })
}

/**
 * Create
 */
exports.create = function(req, res) {
    if(!req.body.clicks) req.body.clicks = 0;
    if(!req.body.duration) req.body.duration = 0;
    if (!req.body.original_title) req.body.original_title = req.body.title;

    var array_vod_vod_categories = req.body.vod_vod_categories || [];
    delete req.body.vod_vod_categories;

    var array_package_vod = req.body.package_vods || [];
    delete req.body.package_vods;

    req.body.company_id = req.token.company_id; //save record for this company
    var limit = req.app.locals.backendsettings[req.token.company_id].asset_limitations.vod_limit; //number of vod items that this company can create

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
                winston.error(err);
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
exports.read = function(req, res) {
    if(req.vod.company_id === req.token.company_id) res.json(req.vod);
    else return res.status(404).send({message: 'No data with that identifier has been found'});
};

/**
 * Update
 */
exports.update = function(req, res) {

    var updateData = req.vod;
    if(updateData.icon_url != req.body.icon_url) {
        var deletefile = path.resolve('./public'+updateData.icon_url);
    }
    if(updateData.image_url != req.body.image_url) {
        var deleteimage = path.resolve('./public'+updateData.image_url);
    }

    var array_vod_vod_categories = req.body.vod_vod_categories || [];
    delete req.body.vod_vod_categories;

    var array_package_vod = req.body.package_vods || [];
    delete req.body.package_vods;

    if(req.vod.company_id === req.token.company_id){
        updateData.update(req.body).then(function(result) {
            if(deletefile) {
                fs.unlink(deletefile, function (err) {
                    //todo: return some warning
                });
            }
            logHandler.add_log(req.token.id, req.ip.replace('::ffff:', ''), 'created', JSON.stringify(req.body), req.token.company_id);
            if(deleteimage) {
                fs.unlink(deleteimage, function (err) {
                    //todo: return some warning
                });
            }
            return link_vod_with_genres(req.body.id,array_vod_vod_categories, db.vod_vod_categories, req.token.company_id).then(function(t_result) {
                if (t_result.status) {
                    return link_vod_with_packages(req.body.id, array_package_vod, db.package_vod, req.token.company_id).then(function(t_result) {
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
        }).catch(function(err) {
            winston.error(err);
            return res.status(400).send({
                message: errorHandler.getErrorMessage(err)
            });
        });
    }
    else{
        res.status(404).send({message: 'User not authorized to access these data'});
    }

};


/**
 * Delete
 */
exports.delete = function(req, res) {
    //delete single vod item and it's dependencies, as long as the item doesn't belong to a package
    db.package_vod.findAll({
        where: {vod_id: req.vod.id, company_id: req.token.company_id}
    }).then(function (delete_vod) {
        if (delete_vod && delete_vod.length > 0) {
            return res.status(400).send({message: 'This item belongs to at least one package. Please remove it from the packages and try again'});
        }
        else {
            return sequelize_t.sequelize.transaction(function (t) {
                return db.vod_vod_categories.destroy({where: {vod_id: req.vod.id}}, {transaction: t}).then(function (removed_genres) {
                    return db.vod_stream.destroy({where: {vod_id: req.vod.id}}, {transaction: t}).then(function (removed_genres) {
                        return db.vod_subtitles.destroy({where: {vod_id: req.vod.id}}, {transaction: t}).then(function (removed_subtitles) {
                            return db.vod.destroy({where: {id: req.vod.id, company_id: req.token.company_id}}, {transaction: t});
                        });
                    });
                });
            }).then(function (result) {
                return res.json(result);
            }).catch(function (err) {
                winston.error("Error deleting vod item, error: ", err);
                return res.status(400).send({message: 'Deleting this vod item failed : ' + err});
            });
        }
    }).catch(function (error) {
        winston.error("Error searching vod item, error: ", error);
        return res.status(400).send({message: 'Searching for this vod item failed : ' + error});
    });

};

exports.list = function(req, res) {
    var qwhere = {},
        final_where = {},
        query = req.query;

    if (query.q) {
        let filters = []
        filters.push(
            { title: { [Op.like]: `%${query.q}%` } },
            { description: { [Op.like]: `%${query.q}%` } },
            { director: { [Op.like]: `%${query.q}%` } },
        );
        qwhere = { [Op.or]: filters };
    }
    if(query.title) qwhere.title = {[Op.like]: '%'+query.title+'%'};

    //filter films added in the following time interval
    if(query.added_before && query.added_after) qwhere.createdAt = {[Op.lt]: query.added_before, [Op.gt]: query.added_after};
    else if(query.added_before) qwhere.createdAt = {[Op.lt]: query.added_before};
    else if(query.added_after) qwhere.createdAt = {[Op.gt]: query.added_after};
    //filter films updated in the following time interval
    if(query.updated_before && query.updated_after) qwhere.createdAt = {[Op.lt]: query.updated_before, [Op.gt]: query.updated_after};
    else if(query.updated_before) qwhere.createdAt = {[Op.lt]: query.updated_before};
    else if(query.updated_after) qwhere.createdAt = {[Op.gt]: query.updated_after};
    if(query.expiration_time) qwhere.expiration_time = query.expiration_time;
    if(query.isavailable === 'true') qwhere.isavailable = true;
    else if(query.isavailable === 'false') qwhere.isavailable = false;
    if(query.pin_protected === '1') qwhere.pin_protected = true;
    else if(query.pin_protected === '0') qwhere.pin_protected = false;

    final_where.attributes = [ 'id', 'company_id','imdb_id','title','original_title', 'description', 'tagline', 'homepage', 'spoken_languages',[sequelize_t.sequelize.fn("concat", req.app.locals.backendsettings[req.token.company_id].assets_url, sequelize_t.sequelize.col('vod.icon_url')), 'icon_url'],
        [sequelize_t.sequelize.fn("concat", req.app.locals.backendsettings[req.token.company_id].assets_url, sequelize_t.sequelize.col('vod.image_url')), 'image_url'],
        'clicks', 'rate', 'vote_average','vote_count', 'popularity', 'duration','director', 'starring', 'trailer_url', 'vod_preview_url', 'pin_protected', 'adult_content', 'isavailable', 'default_subtitle_id',
        'expiration_time', 'price', 'mandatory_ads', 'revenue', 'budget', 'original_language', 'release_date', 'status', 'createdAt', 'updatedAt'],

        //start building where
    final_where.where = qwhere;
    if(parseInt(query._end) !== -1){
        if(parseInt(query._start)) final_where.offset = parseInt(query._start);
        if(parseInt(query._end)) final_where.limit = parseInt(query._end)-parseInt(query._start);
    }
    if(query._orderBy) final_where.order = [[escape.col(query._orderBy), escape.orderDir(query._orderDir)]];
    else final_where.order = [['createdAt', 'DESC']];

    var package_filter = (req.query.package_id) ? {
        where: {package_id: Number(req.query.package_id)},
        required: true
    } : {where: {package_id: {[Op.gt]: 0}}, required: false};
    var category_filter = (req.query.category) ? {
        where: {category_id: Number(req.query.category), is_available: true},
        required: true
    } : {where: {category_id: {[Op.gt]: 0}, is_available: true}, required: false};

    final_where.include = [
        {
            model: db.vod_vod_categories,
            attributes: ['category_id'],
            where: category_filter.where,
            required: category_filter.required
        },
        {
            model: db.package_vod,
            attributes: ['package_id'],
            required: package_filter.required,
            where: package_filter.where
        }
    ];

    final_where.distinct = true; //avoids wrong count number when using includes
    //end build final where

    final_where.where.company_id = req.token.company_id; //return only records for this company

    if(query.not_id){
        db.package_vod.findAll({attributes: [ 'vod_id'], where: {package_id: query.not_id}}).then(function(excluded_vod_items){
            //prepare array with id's of all vod items that belong to specified package
            var excluded_item_list = [];
            for(var i=0; i<excluded_vod_items.length; i++) excluded_item_list.push(excluded_vod_items[i].vod_id);
            if(excluded_item_list.length > 0) qwhere.id = {[Op.notIn]: excluded_item_list}; //if there are items to be excluded, add notIn filter

            DBModel.findAndCountAll(final_where).then(function(results) {
                if (!results) return res.status(404).send({message: 'No data found'});
                else {
                    res.setHeader("X-Total-Count", results.count);
                    res.json(results.rows);
                }
            }).catch(function(err) {
                winston.error(err);
                res.jsonp(err);
            });
        });
    }
    else{
        DBModel.findAndCountAll(
            final_where
        ).then(function(results) {
            if (!results) {
                return res.status(404).send({
                    message: 'No data found'
                });
            } else {
                res.setHeader("X-Total-Count", results.count);
                res.json(results.rows);
            }
        }).catch(function(err) {
            winston.error(err);
            res.jsonp(err);
        });
    }



};

/**
 * middleware
 */
exports.dataByID = function (req, res, next) {
    const COMPANY_ID = req.token.company_id || 1;
    const getID = Joi.number().integer().required();
    const {error, value} = getID.validate(req.params.vodId);

    if (error) {
        return res.status(400).send({
            message: 'Data is invalid'
        });
    }

    DBModel.findOne({
        where: {
            id: value
        },
        include: [
            {model: db.vod_vod_categories, where: {is_available: true}, required: false}, //outer join, to display also movies that don't belong to any category
            {model: db.package_vod, required: false}, {
                model: db.vod_subtitles,
                attributes: ['id', 'title', ['id', 'value'], ['title', 'label']]
            }, {model: db.vod_stream}
        ]
    }).then(function (result) {
        if (!result) {
            return res.status(404).send({
                message: 'No data with that identifier has been found'
            });
        } else {
            req.vod = result;
            let protocol = new RegExp('^(https?|ftp)://');
            if (protocol.test(req.body.icon_url)) {
                let url = req.body.icon_url;
                let pathname = new URL(url).pathname;
                req.body.icon_url = pathname;
            } else {
                req.vod.icon_url = req.app.locals.backendsettings[COMPANY_ID].assets_url + result.icon_url;
            }

            let protocol_small_icon = new RegExp('^(https?|ftp)://');
            if (protocol_small_icon.test(req.body.image_url)) {
                let url = req.body.image_url;
                let pathname = new URL(url).pathname;
                req.body.image_url = pathname;
            } else {
                req.vod.image_url = req.app.locals.backendsettings[COMPANY_ID].assets_url + result.image_url;
            }

            let protocol_vod_preview_url = new RegExp('^(https?|ftp)://');
            if (protocol_vod_preview_url.test(req.body.vod_preview_url)) {
                let url = req.body.vod_preview_url;
                let pathname = new URL(url).pathname;
                req.body.vod_preview_url= pathname;
            } else {
                req.vod.vod_preview_url = req.app.locals.backendsettings[COMPANY_ID].assets_url + result.vod_preview_url;
            }
            next();
        }
        return null;
    }).catch(function (err) {
        winston.error("Error at vod", err);
        return res.status(500).send({
            message: 'Error at getting vod data'
        });
    });

};


/**
 * @api {post} /api/update_film/ update film
 * @apiVersion 0.2.0
 * @apiName UpdateFilm3rdParty
 * @apiGroup Backoffice
 * @apiHeader {String} authorization Token string acquired from login api.
 * @apiDescription Gets movie information from a third party and updates movie
 * @apiSuccessExample Success-Response:
 *     {
 *       "title": "Pan's Labyrinth",
 *       "imdb_id": "tt0457430",
 *       "description": "In the falangist Spain of 1944, ...",
 *       "year": "2006",
 *       "rate": 8,
 *       "duration": "118",
 *       "director": "Guillermo del Toro",
 *       "starring": "Ivana Baquero, Sergi López, Maribel Verdú, Doug Jones"
 *      }
 * @apiErrorExample Error-Response:
 *     {
 *        "message": "error message"
 *     }
 *     Error value set:
 *     An error occurred while updating this movie // Unexpected error occurred when the movie was being updated with teh new data
 *     Could not find this movie // the search params did not return any movie
 *     An error occurred while searching for this movie // Unexpected error occurred while searching for the movie in our database
 *     An error occurred while trying to get this movie's data // Unexpected error occurred while getting the movie's data from the 3rd party
 *     Unable to parse response // The response from the 3rd party service was of invalid format
 *     Unable to find the movie specified by your keywords // The 3rd party service could not find a match using our keywords
 *
 */
exports.update_film = function(req, res) {

    //todo: take care of case when param list is empty.
    var vod_where = {};
    if(req.body.imdb_id) vod_where.imdb_id = req.body.imdb_id;
    else if(req.body.vod_id) vod_where.id = req.body.vod_id;
    else {
        if(req.body.title) vod_where.title = req.body.title;
        if(req.body.year) vod_where.year = req.body.year;
    }

    DBModel.findOne({
        attributes: ['title', 'imdb_id'], where: vod_where
    }).then(function(vod_data){
        if(vod_data){
            var search_params = {"vod_title": vod_data.title};
            if(vod_data.imdb_id !== null) search_params.imdb_id = vod_data.imdb_id; //only use if it is not null
            omdbapi(search_params, function(error, response){
                if(error){
                    return res.status(404).send({
                        message: response
                    });
                }
                else{
                    DBModel.update(
                        response, {where: vod_where}
                    ).then(function(result){
                        res.send(response);
                    }).catch(function(error){
                        winston.error(error);
                        return res.status(404).send({
                            message: "An error occurred while updating this movie"
                        });
                    });
                    return null;
                }
            });
        }
        else return res.status(404).send({
            message: "Could not find this movie"
        });
    }).catch(function(error){
        winston.error(error);
        return res.status(404).send({
            message: "An error occurred while searching for this movie"
        });
    })



};

async function omdbapi(vod_data, callback) {
  let api_key = "a421091c"; //todo: dynamic value
  let search_params = "";
  if (vod_data.imdb_id) {
    search_params = search_params + '&' + 'i=' + vod_data.imdb_id;
  } else {
    if (vod_data.vod_title) search_params = search_params + '&' + 't=' + vod_data.vod_title;
    if (vod_data.year) search_params = search_params + '&' + '&y=' + vod_data.year;
  }

  if (search_params !== "") {
    try {
      const options = {
        url: 'http://www.omdbapi.com/?apikey=' + api_key + search_params,
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      };
      let response = await axios(options);
      try {
        let vod_data = {
          title: response.data.Title,
          imdb_id: response.data.imdbID,
          //category: JSON.parse(response.data).Genre, //todo:get categories list, match them with our list
          description: response.data.Plot,
          //icon_url: JSON.parse(response.data).Poster, //todo: check if url is valid. donwload + resize image. if successful, pass new filename as param
          rate: parseInt(response.data.imdbRating),
          duration: response.data.Runtime.replace(' min', ''),
          director: response.data.Director,
          starring: response.data.Actors,
          //pin_protected: (['R', 'X', 'PG-13'].indexOf(JSON.parse(response.data).Rated) !== -1) ? 1 : 0 //todo: will this rate be taken into consideration?
        };
        callback(null, vod_data);
      } catch (error) {
        callback(true, "Unable to parse response");
      }
    } catch (error) {
      callback(true, "An error occurred while trying to get this movie's data");
    }
  } else {
    callback(true, "Unable to find the movie specified by your keywords");
  }
}