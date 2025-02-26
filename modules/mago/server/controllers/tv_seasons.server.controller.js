'use strict';
var winston = require("winston");

/**
 * Module dependencies.
 */
const path = require('path'),
    errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller')),
    logHandler = require(path.resolve('./modules/mago/server/controllers/logs.server.controller')),
    db = require(path.resolve('./config/lib/sequelize')).models,
    sequelize_t = require(path.resolve('./config/lib/sequelize')),
    DBModel = db.tv_season,
    fs = require('fs'),
    escape = require(path.resolve('./custom_functions/escape'));
const { Op } = require('sequelize');
const axios = require('axios').default;
const Joi = require("joi");

/**
 * Create
 */
exports.create = function(req, res) {
    if(!req.body.clicks) req.body.clicks = 0;
    if(!req.body.duration) req.body.duration = 0;

    req.body.company_id = req.token.company_id; //save record for this company

    DBModel.create(req.body).then(function(result) {
        if (!result) {
            return res.status(400).send({message: 'fail create data'});
        } else {
            logHandler.add_log(req.token.id, req.ip.replace('::ffff:', ''), 'created', JSON.stringify(req.body));
            return res.jsonp(result);
        }
    }).catch(function(err) {
        winston.error("Error creating tv season, error: ",err);
        return res.status(400).send({
            message: errorHandler.getErrorMessage(err)
        });
    });
};


/**
 * Show current
 */
exports.read = function(req, res) {
    if(req.tv_season.company_id === req.token.company_id) res.json(req.tv_season);
    else return res.status(404).send({message: 'No data with that identifier has been found'});
};

/**
 * Update
 */
exports.update = function(req, res) {

    var updateData = req.tv_season;
    if(updateData.icon_url != req.body.icon_url) {
        var deletefile = path.resolve('./public'+updateData.icon_url);
    }
    if(updateData.image_url != req.body.image_url) {
        var deleteimage = path.resolve('./public'+updateData.image_url);
    }

    if(req.tv_season.company_id === req.token.company_id){
        updateData.update(req.body).then(function(result) {
            if(deletefile) {
                fs.unlink(deletefile, function (err) {
                    //todo: return some warning
                });
            }
            logHandler.add_log(req.token.id, req.ip.replace('::ffff:', ''), 'created', JSON.stringify(req.body));
            if(deleteimage) {
                fs.unlink(deleteimage, function (err) {
                    //todo: return some warning
                });
            }
            return res.jsonp(result);
        }).catch(function(err) {
            winston.error("Error updating attributes at tv season, error: ", err);
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
    return sequelize_t.sequelize.transaction(function (t) {
        return db.tv_episode.destroy({where: {tv_season_id: req.tv_season.id}}, {transaction: t}).then(function (removed_genres) {
            return db.tv_season.destroy({where: {id: req.tv_season.id, company_id: req.token.company_id}}, {transaction: t});
        });
    }).then(function (result) {
        return res.json(result);
    }).catch(function (err) {
        winston.error("Error at deleting tv season item, error: ",err);
        return res.status(400).send({message: 'Deleting this tv season item failed : ' + err});
    });
};

exports.list = function(req, res) {
    var qwhere = {},
        final_where = {},
        query = req.query;

    if(query.q) {
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
    if(query.is_available === 'true') qwhere.is_available = true;
    else if(query.is_available === 'false') qwhere.is_available = false;

    //start building where
    final_where.where = qwhere;
    if(parseInt(query._end) !== -1){
        if(parseInt(query._start)) final_where.offset = parseInt(query._start);
        if(parseInt(query._end)) final_where.limit = parseInt(query._end)-parseInt(query._start);
    }
    if(query._orderBy) final_where.order = [[escape.col(query._orderBy), escape.orderDir(query._orderDir)]];

    final_where.where.company_id = req.token.company_id; //return only records for this company
    final_where.attributes = [ 'id', 'company_id','tv_show_id','season_number','imdb_id','title','original_title','description','tagline', 'homepage','spoken_languages','clicks', 'rate',
        'vote_average','vote_count', 'popularity','duration','director','cast', 'trailer_url', 'vod_preview_url', 'expiration_time','original_language',
        'price', 'mandatory_ads', 'revenue', 'budget', 'status', 'expiration_time', 'is_available', 'createdAt', 'updatedAt',
        [sequelize_t.sequelize.fn("concat", req.app.locals.backendsettings[req.token.company_id].assets_url, sequelize_t.sequelize.col('icon_url')), 'icon_url'],
        [sequelize_t.sequelize.fn("concat", req.app.locals.backendsettings[req.token.company_id].assets_url, sequelize_t.sequelize.col('image_url')), 'image_url']];

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
        winston.error("Error finding tv season, error:",err);
        res.jsonp(err);
    });

};

/**
 * middleware
 */
exports.dataByID = function(req, res, next) {
    const COMPANY_ID = req.token.company_id || 1;
    const getID = Joi.number().integer().required();
    const {error, value} = getID.validate(req.params.SeasonId);

    if (error) {
        return res.status(400).send({
            message: 'Data is invalid'
        });
    }

    DBModel.findOne({
        where: {
            id: value
        }
    }).then(function(result) {
        if (!result) {
            return res.status(404).send({
                message: 'No data with that identifier has been found'
            });
        } else {
            req.tv_season = result;
            let protocol = new RegExp('^(https?|ftp)://');
            if (protocol.test(req.body.icon_url)) {
                let url = req.body.icon_url;
                let pathname = new URL(url).pathname;
                req.body.icon_url = pathname;
            } else {
                req.tv_season.icon_url = req.app.locals.backendsettings[COMPANY_ID].assets_url + result.icon_url;
            }

            let protocol_small_icon = new RegExp('^(https?|ftp)://');
            if (protocol_small_icon.test(req.body.image_url)) {
                let url = req.body.image_url;
                let pathname = new URL(url).pathname;
                req.body.image_url = pathname;
            } else {
                req.tv_season.image_url = req.app.locals.backendsettings[COMPANY_ID].assets_url + result.image_url;
            }
            next();
            return null;
        }
    }).catch(function(err) {
        winston.error("",err);
        return res.status(500).send({
            message: 'Error at getting tv series data'
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
    var tv_season_where = {};
    if(req.body.imdb_id) tv_season_where.imdb_id = req.body.imdb_id;
    else if(req.body.tv_season_id) tv_season_where.id = req.body.tv_season_id;
    else {
        if(req.body.title) tv_season_where.title = req.body.title;
        if(req.body.year) tv_season_where.year = req.body.year;
    }

    DBModel.findOne({
        attributes: ['title', 'imdb_id'], where: tv_season_where
    }).then(function(tv_season_data){
        if(tv_season_data){
            var search_params = {"tv_season_title": tv_season_data.title};
            if(tv_season_data.imdb_id !== null) search_params.imdb_id = tv_season_data.imdb_id; //only use if it is not null
            omdbapi(search_params, function(error, response){
                if(error){
                    return res.status(404).send({
                        message: response
                    });
                }
                else{
                    DBModel.update(
                        response, {where: tv_season_where}
                    ).then(function(result){
                        res.send(response);
                    }).catch(function(error){
                        winston.error("A error occurred while updating a tv season movie, error: ",error);
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
        winston.error("Error at searching a movie at tv seasons, error: ",error);
        return res.status(404).send({
            message: "An error occurred while searching for this movie"
        });
    })



};

async function omdbapi(tv_season_data, callback){
    let api_key = "a421091c"; //todo: dynamic value
    let search_params = "";
    if(tv_season_data.imdb_id) {
        search_params = search_params+'&'+'i='+tv_season_data.imdb_id;
    } else {
        if(tv_season_data.tv_season_title) search_params = search_params+'&'+'t='+tv_season_data.tv_season_title;
        if(tv_season_data.year) search_params = search_params+'&'+'&y='+tv_season_data.year;
    }

    if(search_params !== ""){
        let options = {
            url: 'http://www.omdbapi.com/?apikey='+api_key+search_params,
            method: 'get',
            headers: {
                'Content-Type': 'application/json'
            }
        };
        try {
            let response = await axios(options);
            try {
                var tv_season_data = {
                    title: response.data.Title,
                    imdb_id: response.data.imdbID,
                    //category: JSON.parse(response.data).Genre, //todo:get categories list, match them with our list
                    description: response.data.Plot,
                    year: response.data.Year,
                    //icon_url: JSON.parse(response.data).Poster, //todo: check if url is valid. donwload + resize image. if successful, pass new filename as param
                    rate: parseInt(response.data.imdbRating),
                    duration: response.data.Runtime.replace(' min', ''),
                    director: response.data.Director,
                    starring: response.data.Actors,
                    //pin_protected: (['R', 'X', 'PG-13'].indexOf(JSON.parse(response.data).Rated) !== -1) ? 1 : 0 //todo: will this rate be taken into consideration?
                };
                callback(null, tv_season_data);
            }
            catch (error) {
                callback(true, "Unable to parse response");
            }
        } catch (error) {
            callback(true, "An error occurred while trying to get this movie's data");
        }
    } else {
        callback(true, "Unable to find the movie specified by your keywords");
    }

}