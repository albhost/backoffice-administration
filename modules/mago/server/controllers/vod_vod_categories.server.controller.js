'use strict';

/**
 * Module dependencies.
 */
const path = require('path'),
    errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller')),
    logHandler = require(path.resolve('./modules/mago/server/controllers/logs.server.controller')),
    winston = require('winston'),
    db = require(path.resolve('./config/lib/sequelize')).models,
    DBModel = db.vod,
    fs = require('fs'),
    escape = require(path.resolve('./custom_functions/escape'));
const { Op } = require('sequelize');
const axios = require('axios').default;
const Joi = require("joi");

/**
 * Create
 */
exports.create = function(req, res) {
    req.body.company_id = req.token.company_id; //save record for this company
    DBModel.create(req.body).then(function(result) {
        if (!result) {
            return res.status(400).send({message: 'fail create data'});
        } else {
            logHandler.add_log(req.token.id, req.ip.replace('::ffff:', ''), 'created', JSON.stringify(req.body));
            return res.jsonp(result);
        }
    }).catch(function(err) {
        winston.error("Creating vod item failed with error: ", err);
        return res.status(400).send({
            message: errorHandler.getErrorMessage(err)
        });
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

    if(req.vod.company_id === req.token.company_id){
        updateData.update(req.body).then(function(result) {
            if(deletefile) {
                fs.unlink(deletefile, function (err) {
                    //todo: return some warning
                });
            }
            if(deleteimage) {
                fs.unlink(deleteimage, function (err) {
                    //todo: return some warning
                });
            }
            logHandler.add_log(req.token.id, req.ip.replace('::ffff:', ''), 'created', JSON.stringify(req.body));
            return res.json(result);
        }).catch(function(err) {
            winston.error("Updating vod item failed with error: ", err);
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
    var deleteData = req.vod;
    DBModel.findByPk(deleteData.id).then(function(result) {
        if (result) {
            if (result && (result.company_id === req.token.company_id)) {
                result.destroy().then(function() {
                    return res.json(result);
                }).catch(function(err) {
                    winston.error("Deleting vod failed with error: ", err);
                    return res.status(400).send({
                        message: errorHandler.getErrorMessage(err)
                    });
                });
                return null;
            }
            else{
                return res.status(400).send({message: 'Unable to find the Data'});
            }
        } else {
            return res.status(400).send({
                message: 'Unable to find the Data'
            });
        }
    }).catch(function(err) {
        winston.error("Finding vod failed with error: ", err);
        return res.status(400).send({
            message: errorHandler.getErrorMessage(err)
        });
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
    //if(query.category) qwhere.category_id = query.category; todo: do we need this?

    //filter films added in the following time interval
    if(query.added_before && query.added_after) qwhere.createdAt = {[Op.lt]: query.added_before, [Op.gt]: query.added_after};
    else if(query.added_before) qwhere.createdAt = {[Op.lt]: query.added_before};
    else if(query.added_after) qwhere.createdAt = {[Op.gt]: query.added_after};
    //filter films updated in the following time interval
    if(query.updated_before && query.updated_after) qwhere.createdAt = {[Op.lt]: query.updated_before, [Op.gt]: query.updated_after};
    else if(query.updated_before) qwhere.createdAt = {[Op.lt]: query.updated_before};
    else if(query.updated_after) qwhere.createdAt = {[Op.gt]: query.updated_after};

    //start building where
    final_where.where = qwhere;
    if(parseInt(query._end) !== -1){
        if(parseInt(query._start)) final_where.offset = parseInt(query._start);
        if(parseInt(query._end)) final_where.limit = parseInt(query._end)-parseInt(query._start);
    }
    if(query._orderBy) final_where.order = [[escape.col(query._orderBy), escape.orderDir(query._orderDir)]];
    final_where.include = [db.vod_vod_categories, db.package];
    //end build final where

    final_where.where.company_id = req.token.company_id; //return only records for this company

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
        winston.error("Getting vod list failed with error: ", err);
        res.jsonp(err);
    });
};

/**
 * middleware
 */
exports.dataByID = function(req, res, next) {

    const getID = Joi.number().integer().required();
    const {error, value} = getID.validate(req.params.packageChannelId);

    if (error) {
        return res.status(400).send({
            message: 'Data is invalid'
        });
    }

    DBModel.findOne({
        where: {
            id: value
        },
        include: [{model: db.vod_category}, {model: db.package},{model: db.vod_subtitles, attributes: ['id', 'title', ['id', 'value'], ['title', 'label']]},{model: db.vod_stream}]
    }).then(function(result) {
        if (!result) {
            return res.status(404).send({
                message: 'No data with that identifier has been found'
            });
        } else {
            req.vod = result;
            next();
            return null;
        }
    }).catch(function(err) {
        winston.error("Getting vod item failed with error: ", err);
        return res.status(500).send({
            message: 'Error at getting vod categories data'
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

    vod_where.company_id = req.token.company_id; //return only records for this company

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
                        winston.error("Updating vod item failed with error: ", err);
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
        winston.error("Finding vod item failed with error: ", err);
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
        const options = {
            url: 'http://www.omdbapi.com/?apikey=' + api_key + search_params,
            method: 'get',
            headers: {
                'Content-Type': 'application/json'
            }
        };
        try {
            let response = await axios(options);
            try {
                var vod_data = {
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
                callback(null, vod_data);
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