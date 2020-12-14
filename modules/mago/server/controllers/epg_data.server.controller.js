'use strict';

/**
 * Module dependencies.
 */
var path = require('path'),
    errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller')),
    fileHandler = require(path.resolve('./modules/mago/server/controllers/common.controller')),
    db = require(path.resolve('./config/lib/sequelize')),
    fastcsv = require('fast-csv'),
    xml2js = require('xml2js'),
    async = require('async'),
    fs = require('fs'),
    iconv = require('iconv-lite'),
    moment = require('moment'),
    dateFormat = require('dateformat'),
    DBChannels = db.models.channels,
    DBModel = db.models.epg_data,
    xmltv = require('../../../../config/lib/xmltv'),
    winston = require(path.resolve('./config/lib/winston')),
    Joi = require("joi"),
    models = db.models;
const { Op } = require('sequelize');
const download = require('download');
const escape = require(path.resolve('./custom_functions/escape'));
const {Storage} = require('@google-cloud/storage');

const Sequelize = require("sequelize")


/**
 * Create
 */
exports.create = async function (req, res) {

    req.body.company_id = req.token.company_id;
    const {title, channel_number, icon_url, company_id} = req.body


    const imageFound = await ifExists(title, channel_number, icon_url, company_id)

    if(!imageFound) {
        return res.status(400).send({
            message: "The image you trying to add has no respective EPG match"
        });
    }

    DBChannels.findOne({
        attributes: ['id'], where: {channel_number: req.body.channel_number, company_id: req.token.company_id}
    }).then(function (result) {

        if (result) {
            req.body.channels_id = result.id;
            req.body.company_id = req.token.company_id; //save record for this company

            const {company_id, channel_number, channels_id, timezone, title, episode_title, short_name, short_description, event_category, event_language, event_rating,
                program_start, program_end, long_description, duration_seconds, livestream, createdAt, updatedAt } = req.body
            DBModel.create({
                company_id: company_id,
                channel_number:channel_number,
                channels_id:channels_id,
                timezone:timezone,
                title:title,
                episode_title:episode_title,
                short_name:short_name,
                short_description:short_description,
                event_category:event_category,
                event_language:event_language,
                event_rating:event_rating,
                program_start:program_start,
                program_end:program_end,
                long_description:long_description,
                duration_seconds:duration_seconds,
                livestream:livestream,
                createdAt:createdAt,
                updatedAt:updatedAt

            }).then(function (result) {

                if (!result) {
                    return res.status(400).send({message: 'fail create data'});
                } else {
                    return res.jsonp(result);
                }
            }).catch(function (err) {
                winston.error("Creating event failed with error: ", err);
                return res.status(400).send({
                    message: errorHandler.getErrorMessage(err)
                });
            });
        } else {
            return res.send({
                message: "Channel not found"
            });
        }
        return null;
    }).catch(function (err) {
        winston.error("Finding channel failed with error: ", err);
        return res.status(400).send({
            message: errorHandler.getErrorMessage(err)
        });
    });







};

const ifExists = async function (title, channel_number, icon_url, company_id) {

    let result = await db.models.program_content.findOne({
        where: {title: title, company_id: company_id, channel_id: channel_number},
    })

    if (result) {
        const updateEpgImage = db.models.program_content.update({
            icon_url: icon_url
        }, {
            where: {
                title: title
            }
        })

        if (!updateEpgImage) {
            return null;
        } else return true
    }
    const createEpgImage = db.models.program_content.create({
        company_id: company_id,
        channel_id: channel_number,
        title: title,
        icon_url: icon_url
    })

    if (!createEpgImage) {
        res.status(400).send({message: 'Failed to create image program content'});
        return;
    } else return true
}

/**
 * Create
 */
exports.epg_import = function (req, res) {

    var qwhere = {},
        final_where = {},
        query = req.query;

    if (query.q) {
        let filters = []
        filters.push(
            { channel_number: { [Op.like]: `%${query.q}%` } },
            { title: { [Op.like]: `%${query.q}%` } },
            { short_name: { [Op.like]: `%${query.q}%` } },
            { short_description: { [Op.like]: `%${query.q}%` } },
            { long_description: { [Op.like]: `%${query.q}%` } }
        );
        qwhere = { [Op.or]: filters };
    }


    //start building where
    final_where.where = qwhere;
    if (parseInt(query._start)) final_where.offset = parseInt(query._start);
    if (parseInt(query._end)) final_where.limit = parseInt(query._end) - parseInt(query._start);
    if(query._orderBy) final_where.order = [[escape.col(query._orderBy), escape.orderDir(query._orderDir)]];

    final_where.include = [];
    //end build final where

    final_where.where.company_id = req.token.company_id; //return only records for this company

    DBModel.findAndCountAll(
        final_where
    ).then(function (results) {
        if (!results) {
            return res.status(404).send({
                message: 'No data found'
            });
        } else {
            res.setHeader("X-Total-Count", results.count);
            res.json(results.rows);
        }
    }).catch(function (err) {
        winston.error("Getting event list failed with error: ", err);
        res.jsonp(err);
    });
};


/**
 * Show current
 */
exports.read = function (req, res) {
    if (req.epgData.company_id === req.token.company_id) res.json(req.epgData);
    else return res.status(404).send({message: 'No data with that identifier has been found'});
};

/**
 * Update
 */
exports.update = function (req, res) {
    var updateData = req.epgData;

    if (req.epgData.company_id === req.token.company_id) {
        const schema = Joi.object().keys({
            company_id: Joi.number().integer().default(1),
            channel_number: Joi.number().integer().required(),
            channels_id: Joi.number().integer(),
            timezone: Joi.number().integer(),
            title: Joi.string().required().max(255),
            episode_title: Joi.string().max(255),
            short_name: Joi.string().max(255),
            short_description: Joi.string(),
            event_category: Joi.string().max(255),
            event_language: Joi.string().max(255),
            event_rating: Joi.number().integer(),
            program_start: Joi.string(),
            program_end: Joi.string(),
            long_description: Joi.string().max(255),
            duration_seconds: Joi.number().integer(),
            livestream: Joi.boolean().default(false),
            genre: Joi.string().max(255),
            audio: Joi.string().max(255),
            rating_score: Joi.number().integer(),
            parental_control: Joi.boolean().default(false),
            content_rating: Joi.string().max(255),
            banner_url: Joi.string().max(255),
            createdAt: Joi.string(),
            updatedAt: Joi.string()
        });

        const { error, value } = schema.validate(req.body);

        const {company_id, channel_number, channels_id, timezone, title, episode_title, short_name, short_description, event_category, event_language, event_rating, program_start,
            program_end, long_description, duration_seconds, livestream, genre, audio, rating_score, parental_control, content_rating, banner_url, createdAt, updatedAt } = value

        try {

            const epgData = updateData.update({
                company_id: company_id,
                channel_number: channel_number,
                channels_id: channels_id,
                timezone: timezone,
                title: title,
                episode_title: episode_title,
                short_name:short_name,
                short_description: short_description,
                event_category: event_category,
                event_language: event_language,
                event_rating: event_rating,
                program_start: program_start,
                program_end: program_end,
                long_description: long_description,
                duration_seconds: duration_seconds,
                livestream: livestream,
                genre: genre,
                audio: audio,
                rating_score: rating_score,
                parental_control: parental_control,
                content_rating: content_rating,
                banner_url: banner_url,
                createdAt: createdAt,
                updatedAt: updatedAt
            },{
                where: { channel_number: channel_number, company_id: company_id, title:title},
            });
            if (!epgData) {
                return res.status(400).send({message: "EPG Data update failed with error"});
            }


            const schema2 = Joi.object().keys({
                icon_url: Joi.string()
            });

            const { error: err, value: validateImage } = schema2.validate(req.body.icon_url)

            const imageFound = ifExists(title, channel_number, validateImage, company_id)

            if(!imageFound) {
                return res.status(400).send({
                    message: "The image you trying to add has no respective EPG match"
                });
            }

            res.json(epgData);

        } catch (e) {
            winston.error("There has been a error in here", e);
            next(e)
        }
    }
    else {
        res.status(404).send({message: 'User not authorized to access these data'});
    }
};


exports.bulkUpload = async function (req, res) {
    const array = req.body.value;
    try {

        for (let i = 0; i < array.length; i++) {

            var ifImageExist = await db.models.program_content.findOne({
                where: {
                    title: array[i].values.title,
                    company_id: array[i].values.company_id,
                    channel_id: array[i].values.channels_id
                },
            })

            if (ifImageExist) {
                const updateEpgImage = await db.models.program_content.update({
                    icon_url: req.body.data.result
                }, {
                    where: {
                        title: array[i].values.title,
                        company_id: array[i].values.company_id,
                        channel_id: array[i].values.channels_id
                    },
                })

                if (!updateEpgImage) {
                    return null;
                }
            } else {
                await db.models.program_content.create({
                    title: array[i].values.title,
                    company_id: array[i].values.company_id,
                    channel_id: array[i].values.channels_id,
                    icon_url: req.body.data.result
                })
            }

        }
        res.json({status: 200, message: "Success"})

    } catch (e) {
        res.status(500).json({status: 500, message: "Error"})
    }


}


function get_file_extention(fileName){
    if (fileName.indexOf('.')>-1){
        var splitlist = fileName.split('.');
        return '.' + splitlist[splitlist.length -1];
    }
    else return '';
}

exports.get_extension = get_file_extention;



/**
 * Delete
 */
exports.delete = function (req, res) {
    var deleteData = req.epgData;

    DBModel.findByPk(deleteData.id).then(function (result) {
        if (result) {
            if (result && (result.company_id === req.token.company_id)) {
                result.destroy().then(function () {
                    return res.json(result);
                }).catch(function (err) {
                    winston.error("Deleting event failed with error: ", err);
                    return res.status(400).send({
                        message: errorHandler.getErrorMessage(err)
                    });
                });
                return null;
            } else {
                return res.status(400).send({message: 'Unable to find the Data'});
            }
        } else {
            return res.status(400).send({
                message: 'Unable to find the Data'
            });
        }
        return null;
    }).catch(function (err) {
        winston.error("Finding event failed with error: ", err);
        return res.status(400).send({
            message: errorHandler.getErrorMessage(err)
        });
    });

};

/**
 * List
 */
exports.list = function (req, res) {

    var qwhere = {},
        final_where = {},
        query = req.query;

    if(query.q) {
        let filters = []
        filters.push(
            { channel_number: { [Op.like]: `%${query.q}%` } },
            { title: { [Op.like]: `%${query.q}%` } },
            { short_name: { [Op.like]: `%${query.q}%` } },
            { short_description: { [Op.like]: `%${query.q}%` } },
            { long_description: { [Op.like]: `%${query.q}%` } }
        );
        qwhere = { [Op.or]: filters };
    }


    if (query.title) qwhere.title = query.title;
    if (query.channel_number) qwhere.channel_number = query.channel_number;

    if (query.program_start && query.program_end) {
        // we have interval
        qwhere.program_start = {};
        qwhere.program_start[Op.gte] = new Date(query.program_start);
        qwhere.program_end = {};
        qwhere.program_end[Op.lte] = new Date(query.program_end);
    } else if (query.program_start) {
        qwhere.program_start = {};
        qwhere.program_start[Op.gte] = new Date(query.program_start);
    } else if (query.program_end) {
        qwhere.program_end = {}
        qwhere.program_end[Op.lte]= new Date(query.program_end);
    }



    //start building where
    final_where.where = qwhere;
    if (parseInt(query._start)) final_where.offset = parseInt(query._start);
    if (parseInt(query._end)) final_where.limit = parseInt(query._end) - parseInt(query._start);
    if(query._orderBy) final_where.order = [[escape.col(query._orderBy), escape.orderDir(query._orderDir)]];

    final_where.include = [];
    //end build final where

    final_where.where.company_id = req.token.company_id; //return only records for this company


    if (req.app.locals.advanced_settings[req.token.company_id] && req.app.locals.advanced_settings[req.token.company_id].google_cloud.storage === true) {
        var asset_url = req.app.locals.backendsettings[req.token.company_id].assets_url
    }
    else asset_url = ""

    final_where.attributes = [ 'livestream', 'id','channel_number','timezone','title','episode_title','short_name','short_description','long_description','event_category',
        'event_rating', 'event_language', 'program_start', 'program_end','duration_seconds', 'channels_id', 'company_id', 'createdAt', 'updatedAt',
         [db.sequelize.literal('(SELECT IFNULL((SELECT CONCAT("' + asset_url + '", icon_url) ' +
             'FROM program_content WHERE program_content.title=epg_data.title AND ' +
        'program_content.channel_id=epg_data.channels_id), "") AS "icon_url")'), 'icon_url']];


    DBModel.findAndCountAll(
        final_where
    ).then(async function (results) {
        if (!results) {
            return res.status(404).send({
                message: 'No data found'
            });
        } else {

            if(query.carousel_type) {
                const {carousel_type} = query;
                let list = [];

                for (let i = 0; i < results.count; i++) {
                    if(!results.rows[i]) continue;
                    const channel_number = results.rows[i].channel_number;

                    const channel = await models.channels.findOne({
                        attributes: ['id', 'channel_number'],
                        where: {channel_number: channel_number, company_id: req.token.company_id}
                    });

                    const query = await models.carousel_channels.findAll({
                        where: {
                            channel_id: {
                                [Op.like]: `%${channel.id}%`
                            },
                            carousel_type
                        }
                    });

                    if(!!query && query.length > 0) {
                        list.push(results.rows[i])
                    }
                }

                res.setHeader("X-Total-Count", list.length);
                res.json(list);
            } else {
                res.setHeader("X-Total-Count", results.count);
                res.json(results.rows);
            }
        }
    }).catch(function (err) {
        winston.error("Getting event list failed with error: ", err);
        res.jsonp(err);
    });
};

exports.list_chart_epg = function (req, res) {

    //get EPG data from last 7 days
    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 0;
    const offset = page * limit;
    const past = new Date();
    const future = new Date();
    past.setDate(past.getDate() - 4);
    future.setDate(future.getDate() + 7);

    DBChannels.findAndCountAll({
        attributes: [['channel_number', 'id'], ['channel_number', 'group'],
            [db.sequelize.fn("concat", db.sequelize.col('channel_number'), " . ", db.sequelize.col('title')), 'content']
        ],
        limit: limit,
        offset: offset,
        where: {company_id: req.token.company_id, isavailable: true},
        order: [['channel_number', 'ASC']]
    }).then(function (channels) {
        const channelsIds = channels.rows.map(ch => ch.id);
        DBModel.findAll({
                attributes: ['id', ['channel_number', 'group'], ['program_start', 'start'], ['program_end', 'end'], ['title', 'content']],
                where: {program_start: {[Op.gte]: past}, program_end: {[Op.lte]: future}, company_id: req.token.company_id, channel_number: {[Op.in]: channelsIds}}
            }
        ).then(function (results) {
            if (!results) {
                return res.status(404).send({
                    message: 'No data found'
                });
            } else {
                res.json({groups: channels.rows, items: results, total_pages: Math.floor(channels.count / limit), page: page});
            }
        }).catch(function (err) {
            winston.error("Getting events for the chart failed with error: ", err);
            res.jsonp(err);
        });
    });
};

/**
 * middleware
 */
exports.dataByID = function (req, res, next) {

    const COMPANY_ID = req.token.company_id || 1;

    const getID = Joi.number().integer().required();
    const {error, value} = getID.validate(req.params.epgDataId);

    if (error) {
        return res.status(400).send({
            message: 'Data is invalid'
        });
    }

    DBModel.findOne({
        where: {
            id: value
        }
    }).then(async(result) => {
        if (!result) {
            return res.send({
                message: 'No data with that identifier has been found'
            });
        } else {
            req.epgData = result;

            const findEpgImg = await db.models.program_content.findOne({attributes: ['channel_id', 'icon_url'],
                where: {channel_id: result.channel_number, company_id: req.token.company_id, title:result.title}
            })

            if (findEpgImg) {
              result.dataValues['icon_url'] = req.app.locals.backendsettings[req.token.company_id].assets_url + findEpgImg.icon_url

            }
        }

        if (req.app.locals.advanced_settings[req.token.company_id] && req.app.locals.advanced_settings[req.token.company_id].google_cloud.storage === true) {
            req.epgData.icon_url = req.app.locals.backendsettings[COMPANY_ID].assets_url + result.dataValues.icon_url;
        }
        else {
            let protocol = new RegExp('^(https?|ftp)://');
            if (protocol.test(result.dataValues['icon_url'])) {
                let url = result.dataValues['icon_url'];
                let pathname = new URL(url).pathname;
                result.dataValues['icon_url'] = pathname;
            }
        }
        next();
        return null;
    }).catch(function (err) {
        winston.error("Finding event failed with error: ", err);
        return res.status(500).send({
            message: 'Error at getting epg data'
        });
    });

};

exports.save_epg_records = async (req, res) => {
    var current_time = dateFormat(Date.now(), "yyyy-mm-dd HH:MM:ss");
    req.body.timezone = (req.body.timezone && (-12 < req.body.timezone < 12)) ? req.body.timezone : 0; //valid timezone input or default timezone 0
    if (!req.body.encoding || ((['ascii', 'utf-8', 'ISO-8859-1'].indexOf('' + req.body.encoding + '') >= 0) === false)) req.body.encoding = 'utf-8'; //valid encoding input or default encoding utf-8

    if (req.app.locals.advanced_settings[req.token.company_id].google_cloud.storage === false) {
        if (req.body.epg_url) {
            //download epg to public/files/temp
            var origin_url = req.body.epg_url;
            var destination_path = "./public/files/temp/";
            var epg_filename = "epg" + Date.now() + origin_url.substring(origin_url.lastIndexOf("."), origin_url.length); //get name of new file

            var options = {
                directory: destination_path,
                filename: epg_filename
            }

            try {
                download(origin_url).pipe(fs.createWriteStream(Object.values(options).join("")));
                if (req.body.epg_file) {
                    req.body.epg_file = req.body.epg_file + ',/files/temp/' + epg_filename; //append filename to req.body.epg_file
                } else {
                    req.body.epg_file = '/files/temp/' + epg_filename; //append filename to req.body.epg_file
                }
                start_epg_import();
            } catch (error) {
                winston.error("error downloading? " + err);
            }
        } else {
            start_epg_import();
        }
    } else {
        start_import_at_storage();
    }

    function start_import_at_storage(){
        return read_and_write_epg_from_storage(current_time);
    }

    function start_epg_import() {
        if (req.body.delete_existing === true) {
            DBModel.destroy({
                where: {company_id: req.token.company_id}
            }).then(function (result) {
                read_and_write_epg(current_time);
                return null;
            }).catch(function (error) {
                if (error.message.split(': ')[0] === 'ER_ROW_IS_REFERENCED_2') return res.status(400).send({message: 'Delete failed: At least one of these programs is scheduled'}); //referenced record cannot be deleted
                else {
                    winston.error("Deleting existing events failed with error: ", error);
                    return res.status(400).send({message: 'Unable to proceed with the action'}); //other error occurred
                }
            });
        } else {
            return read_and_write_epg(current_time);
        }
    }

    function getGCloudEncoding(enc) {
        if(enc === "ISO-8859-1") return "latin1"
        else return enc;
    }

    function read_and_write_epg_from_storage(current_time) {

        let import_log = [];
        if (!req.body.epg_file) {
            res.status(200).send({message: "Cannot import anything because no file specified"})
            return
        }
        const epg_files = req.body.epg_file.split(',');
        async.forEach(epg_files, function (epg_file_result, callback) {
            if (fileHandler.get_extension(epg_file_result) === '.csv') {
                import_csv(req, res, current_time, epg_file_result, import_log, callback);
            } else if (fileHandler.get_extension(epg_file_result) === '.xml') {
                const storage = new Storage();
                const bucketName = req.app.locals.advanced_settings[req.token.company_id].google_cloud.bucket_name;
                const readFile = storage.bucket(bucketName).file(epg_file_result).createReadStream();
                let epg_file = '';
                readFile.on('data', function (d) {
                    epg_file += d.toString(getGCloudEncoding(req.body.encoding));
                }).on('end', function () {
                    import_xml_dga(req, res, current_time, epg_file, import_log, callback);
                });
            } else {
                winston.error('Incorrect file type for file ', epg_file_result)
                callback(null);
            }
        }, function (error, result) {
            return res.status(200).send({message: import_log});
        });
    }




    function read_and_write_epg(current_time) {

        var import_log = []; // file_name saved_records non_saved_records error_log

        if (!req.body.epg_file) {
            //cannot import because no data avalable
            res.status(200).send({message: "Cannot import anything because no file specified"})
            return
        }

        var epg_files = req.body.epg_file.split(',');
        async.forEach(epg_files, function (epg_file, callback) {
            if (fileHandler.get_extension(epg_file) === '.csv') {
                import_csv(req, res, current_time, epg_file, import_log, callback);
            } else if (fileHandler.get_extension(epg_file) === '.xml') {
                //import_xml_standard(req, res, current_time, epg_file, import_log, callback);
                import_xmltv(req, res, current_time, epg_file, import_log, callback);
                //import_xml_dga(req, res, current_time, epg_file, import_log, callback);
            } else {
                winston.error('Incorrect file type for file ', epg_file)
                callback(null);
            }
        }, function (error, result) {
            return res.status(200).send({message: import_log});
        });
    }

}

function import_csv(req, res, current_time, epg_file, import_log, callback) {
    var channel_number_list = [];
    var data;
    var import_file_log = {
        file_name: epg_file,
        saved_records: 0,
        non_saved_records: 0,
        error_log: []
    };

    async.auto({
        //reads entire csv file. saves into channel_number_list only the number of those channels that are in the file and are not filtered out by the channel_number input
        get_channels: function (callback) {
            try {
                var channel_number_stream = fs.createReadStream(path.resolve('./public') + epg_file).pipe(iconv.decodeStream(req.body.encoding)); //link main url
            } catch (error) {
                import_file_log.error_log.push("Could not read file " + epg_file);
                callback(true);
            }
            fastcsv.parseStream(channel_number_stream, {headers: true}, {ignoreEmpty: true}).validate(function (data) {
                if (req.body.channel_number) {
                    return data.channel_number == req.body.channel_number; //if a channel_number is specified, filter out other channels
                } else {
                    return data;
                }
            }).on("data", function (data) {
                if (channel_number_list.indexOf(data.channel_number) === -1) {
                    channel_number_list.push(data.channel_number); //prepare array with numbers of channels whose programs will be imported
                }
            }).on("end", function () {
                callback(null); //reading file ended. pass control to next function
            });
        },
        //deletes future epg for channels whose epg will be imported
        delete_epg: ['get_channels', function (results, callback) {
            if (channel_number_list.length < 1) {
                import_file_log.error_log.push('Error reading csv file ' + epg_file);
                callback(true); // no channels to import epg. pass control to the end
            } else {
                DBModel.destroy({
                    where: {
                        program_start: {[Op.gte]: current_time},
                        channel_number: {[Op.in]: channel_number_list},
                        company_id: req.token.company_id
                    }
                }).then(function (result) {
                    callback(null); // future epg was deleted for channels on our list. pass control to next function
                }).catch(function (error) {
                    winston.error("Deleting previous events failed with error: ", error);
                    if (error.message.split(': ')[0] === 'ER_ROW_IS_REFERENCED_2') import_file_log.error_log.push('Error deleting future events. At least one of these events is scheduled');
                    else import_file_log.error_log.push('Error deleting future events.');
                    callback(null); // error occured while deleting future epg. pass control to the end
                });
            }
        }],
        save_epg: ['delete_epg', function (epg_data, callback) {
            var stream = fs.createReadStream(path.resolve('./public') + epg_file).pipe(iconv.decodeStream(req.body.encoding)); // read csv file
            fastcsv.parseStream(stream, {headers: true}, {ignoreEmpty: true}).validate(function (data) {
                if (req.body.channel_number) {
                    return data.channel_number == req.body.channel_number; //if a channel_number is specified, filter out epg for other channels
                } else return data; //no channel_number was specified, return all records
            }).on("data", function (data) {
                //only insert future programs (where program_start > current). take into account timezone used to generate the epg file
                if (data && (moment(data.program_start, 'MM/DD/YYYY HH:mm:ss').subtract(req.body.timezone, 'hour').format('YYYY-MM-DD HH:mm:ss') > moment(current_time).format('YYYY-MM-DD HH:mm:ss'))) {
                    DBModel.create({
                        channels_id: data.channel_id,
                        channel_number: data.channel_number,
                        title: (data.title) ? data.title : "Program title",
                        short_name: (data.short_name) ? data.short_name : "Program name",
                        short_description: (data.short_description) ? data.short_description : "Program description",
                        program_start: moment(data.program_start, 'MM/DD/YYYY HH:mm:ss').subtract(req.body.timezone, 'hour'),
                        program_end: moment(data.program_end, 'MM/DD/YYYY HH:mm:ss').subtract(req.body.timezone, 'hour'),
                        long_description: (data.long_description) ? data.long_description : "Program summary",
                        duration_seconds: data.duration,
                        company_id: req.token.company_id
                    }).then(function (result) {
                        import_file_log.saved_records++;
                    }).catch(function (error) {
                        winston.error("Saving events failed with error: ", error);
                        import_file_log.non_saved_records++;
                        //import_file_log.error_log.push("Failed to save record '" + data.short_name + "' with error: " + error.name + ": " + error.parent.sqlMessage);
                    });
                } else {
                    import_file_log.error_log.push("Failed to create epg record. Event '" + data.short_name + "' has expired");
                }
            }).on("error", function () {
                callback(null);
            }).on("end", function () {
                callback(null);
            });
        }]
    },function (error, results) {
        import_log.push(import_file_log);
        callback(null);
    });

}

//import xml file, digitalb format
function import_xml_dga(req, res, current_time, epg_file, import_log, callback) {
    var import_file_log = {
        file_name: req.body.epg_file,
        saved_records: 0,
        non_saved_records: 0,
        error_log: []
    };

    if (req.app.locals.advanced_settings[req.token.company_id].google_cloud.storage === true) {
                async.auto({
                    parseEPG: function (callback) {
                        const parser = new xml2js.Parser();
                        parser.parseString(epg_file, function (err, epg_data) {
                            if (err) {
                                import_file_log.error_log.push('Error parsing this xml file');
                                callback(true);
                            } else callback(null, epg_data);
                        });
                    },
                    save_epg: ['parseEPG', (results, callback) => {
                        let all_programs = results.parseEPG.WIDECAST_DVB.channel;


                        async.forEach(all_programs,(channels, callback) => {
                            const channel_name = channels.$.name;
                            const filtered_channel_number = (req.body.channel_number) ? req.body.channel_number : {[Op.gte]: -1};

                            DBChannels.findOne({
                                attributes: ['channel_number', 'id'],
                                where: {epg_map_id: channel_name, channel_number: filtered_channel_number, company_id: req.token.company_id}
                            }).then((channel_data) => {
                                if (channel_data) {
                                    db.models.epg_data.destroy({
                                        where: {
                                            channel_number: channel_data.channel_number,
                                            program_start: {[Op.gte]: current_time},
                                            company_id: req.token.company_id
                                        }
                                    }).then((result) => {
                                        let short_event_name;
                                        let short_event_descriptor;
                                        let long_event_descriptor;

                                        async.forEach(channels.event, (events, callback) => {
                                            try {
                                                 short_event_name = events.short_event_descriptor[0].$.name;
                                            } catch (error) {
                                                 short_event_name = "Program title";
                                            }
                                            try {
                                                 short_event_descriptor = events.short_event_descriptor[0]._;
                                            } catch (error) {
                                                 short_event_descriptor = "Program name";
                                            }
                                            try {
                                                 long_event_descriptor = events.extended_event_descriptor[0].text[0];
                                            } catch (error) {
                                                 long_event_descriptor = "Program summary";
                                            }
                                            if (events && (moment(events.$.start_time).subtract(req.body.timezone, 'hour').format('YYYY-MM-DD HH:mm:ss') > moment(current_time).format('YYYY-MM-DD HH:mm:ss'))) {
                                                db.models.epg_data.create({
                                                    channels_id: channel_data.id,
                                                    channel_number: channel_data.channel_number,
                                                    title: (short_event_name) ? short_event_name : "Program title",
                                                    short_name: (short_event_name) ? short_event_name : "Program name",
                                                    short_description: (short_event_descriptor) ? short_event_descriptor : "Program description",
                                                    program_start: moment(events.$.start_time).subtract(req.body.timezone, 'hour'),
                                                    program_end: moment.unix(parseInt(moment(events.$.start_time).format('X')) + parseInt(events.$.duration) - req.body.timezone * 3600).format('YYYY-MM-DD HH:mm:ss'),
                                                    long_description: (long_event_descriptor) ? long_event_descriptor : "Program summary",
                                                    duration_seconds: events.$.duration,
                                                    company_id: req.token.company_id
                                                }).then((saved_events) => {
                                                    import_file_log.saved_records++;
                                                    callback(null);
                                                }).catch((error) => {
                                                    import_file_log.non_saved_records++;
                                                    import_file_log.error_log.push("Failed to save record '" + short_event_name + "' with error: " + error.name + "- " + error.message);
                                                    callback(null);
                                                });
                                            } else {
                                                import_file_log.non_saved_records++; //event was not saved
                                                import_file_log.error_log.push("Failed to create epg record. Event '" + short_event_name + "' has expired");
                                                callback(null);
                                            }
                                        }, (error) => {
                                            callback(null);
                                        });
                                        return null;
                                    }).catch((error) => {
                                        winston.error("Deleting previous events failed with error: ", error);
                                        import_file_log.error_log.push("Failed to delete events for channel " + channel_name + ": " + error.parent.sqlMessage);
                                        callback(null); //event deletion failed. pass control to next epg record iteration
                                    });
                                } else {
                                    import_file_log.error_log.push("Channel not found: Channel " + channel_name + " either does not exist, or was filtered by your input channel number.");
                                    callback(null);
                                }
                                return null;
                            }).catch((error) => {
                                winston.error("Finding channel failed with error: ", error);
                                import_file_log.error_log.push("Error searching for channel " + error);
                                callback(null);
                            });
                        }, (error) => {
                            callback(null); //passes control to next step, sending status
                        });
                    }]
                },  (error, results) => {
                    import_log.push(import_file_log);
                    callback(null);
                });
    }
    else {
        async.auto({
            read_file: function (callback) {
                try {
                    fs.readFile(path.resolve('./public' + epg_file), function (err, data) {
                        if (err) {
                            import_file_log.error_log.push('Error reading xml file ' + epg_file);
                            callback(true); //file could not be read. add error into logs and stop import for this file
                        } else {
                            var file_encoding = iconv.decode(data, req.body.encoding).split('encoding="')[1].split('"')[0]; //read encoding from epg file
                            var epg_data = iconv.decode(data, file_encoding); //file was read successfully. Decode file to appropriate encoding
                            callback(null, epg_data); //pass execution flow and file content to next function
                        }
                    });
                } catch (error) {
                    import_file_log.error_log.push('Error reading xml file ' + epg_file);
                    callback(true); //file could not be read. add error into logs and stop import for this file
                }
            },
            parse_file: ['read_file', function (results, callback) {
                var parser = new xml2js.Parser();
                parser.parseString(results.read_file, function (err, epg_data) {
                    if (err) {
                        import_file_log.error_log.push('Error parsing this xml file');
                        callback(true); //file was not parsed. add error into logs and stop import for this file
                    } else callback(null, epg_data);//pass execution flow and file content to next function
                });
            }],
            save_epg: ['parse_file', function (results, callback) {
                var all_programs = results.parse_file.WIDECAST_DVB.channel; //stores the whole list of channel objects from the xml file
                // iterate over each channel

                async.forEach(all_programs, function (channels, callback) {
                    var channel_name = channels.$.name;
                    var filtered_channel_number = (req.body.channel_number) ? req.body.channel_number : {[Op.gte]: -1}; //channel from epg file that is being processed, if allowed by channel_number input
                    //find channel id and number for this channel
                    DBChannels.findOne({
                        attributes: ['channel_number', 'id'],
                        where: {epg_map_id: channel_name, channel_number: filtered_channel_number, company_id: req.token.company_id}
                    }).then(function (channel_data) {
                        if (channel_data) {
                            //destroys future epg for filtered channels
                            db.models.epg_data.destroy({
                                where: {
                                    channel_number: channel_data.channel_number,
                                    program_start: {[Op.gte]: current_time},
                                    company_id: req.token.company_id
                                }
                            }).then(function (result) {
                                //iterate over all events of this channel
                                async.forEach(channels.event, function (events, callback) {
                                    try {
                                        var short_event_name = events.short_event_descriptor[0].$.name;
                                    } catch (error) {
                                        var short_event_name = "Program title";
                                    }
                                    try {
                                        var short_event_descriptor = events.short_event_descriptor[0]._;
                                    } catch (error) {
                                        var short_event_descriptor = "Program name";
                                    }
                                    try {
                                        var long_event_descriptor = events.extended_event_descriptor[0].text[0];
                                    } catch (error) {
                                        var long_event_descriptor = "Program summary";
                                    }
                                    if (events && (moment(events.$.start_time).subtract(req.body.timezone, 'hour').format('YYYY-MM-DD HH:mm:ss') > moment(current_time).format('YYYY-MM-DD HH:mm:ss'))) {
                                        //only insert future programs (where program_start > current)
                                        db.models.epg_data.create({
                                            channels_id: channel_data.id,
                                            channel_number: channel_data.channel_number,
                                            title: (short_event_name) ? short_event_name : "Program title",
                                            short_name: (short_event_name) ? short_event_name : "Program name",
                                            short_description: (short_event_descriptor) ? short_event_descriptor : "Program description",
                                            program_start: moment(events.$.start_time).subtract(req.body.timezone, 'hour'),
                                            program_end: moment.unix(parseInt(moment(events.$.start_time).format('X')) + parseInt(events.$.duration) - req.body.timezone * 3600).format('YYYY-MM-DD HH:mm:ss'),
                                            long_description: (long_event_descriptor) ? long_event_descriptor : "Program summary",
                                            duration_seconds: events.$.duration, //is in seconds
                                            company_id: req.token.company_id
                                        }).then(function (saved_events) {
                                            import_file_log.saved_records++;
                                            callback(null);
                                        }).catch(function (error) {
                                            // winston.error("Saving events failed with error: ", error);
                                            import_file_log.non_saved_records++;
                                            import_file_log.error_log.push("Failed to save record '" + short_event_name + "' with error: " + error.name + "- " + error.message);
                                            callback(null);
                                        });
                                    } else {
                                        import_file_log.non_saved_records++; //event was not saved
                                        import_file_log.error_log.push("Failed to create epg record. Event '" + short_event_name + "' has expired");
                                        callback(null);
                                    }
                                }, function (error) {
                                    callback(null);
                                });
                                return null;
                            }).catch(function (error) {
                                winston.error("Deleting previous events failed with error: ", error);
                                import_file_log.error_log.push("Failed to delete events for channel " + channel_name + ": " + error.parent.sqlMessage);
                                callback(null); //event deletion failed. pass control to next epg record iteration
                            });
                        } else {
                            import_file_log.error_log.push("Channel not found: Channel " + channel_name + " either does not exist, or was filtered by your input channel number.");
                            callback(null);
                        }
                        return null;
                    }).catch(function (error) {
                        winston.error("Finding channel failed with error: ", error);
                        import_file_log.error_log.push("Error searching for channel " + error);
                        callback(null);
                    });
                }, function (error) {
                    callback(null); //passes control to next step, sending status
                });
            }]
        }, function (error, results) {
            import_log.push(import_file_log);
            callback(null);
        });
    }


}

exports.create_sample = function (req, res) {

    import_xmltv(res, res, 123456);
}

function import_xmltv(req, res, current_time, epg_file, import_log, callback) {

    var import_file_log = {
        file_name: epg_file,
        saved_records: 0,
        non_saved_records: 0,
        error_log: []
    };

    var channellist = {};
    var xmlfile = path.resolve('./public' + epg_file);
    var input = fs.createReadStream(xmlfile).pipe(iconv.decodeStream(req.body.encoding));
    var parser = new xmltv.Parser();
    var stotal = 0;
    var serrors = 0;
    var ssuccess = 0;
    var epgdata = [];

    //read channels and map channel epg name with names on the epg file
    DBChannels.findAll({
        where: {isavailable: true, company_id: req.token.company_id}
    }).then(function (result) {
        for (var i = 0; i < result.length; i++) {
            if (result[i].epg_map_id != '') {
                channellist[result[i].epg_map_id] = {};
                channellist[result[i].epg_map_id].channel_number = result[i].channel_number;
                channellist[result[i].epg_map_id].channels_id = result[i].id;
            }
        }
        input.pipe(parser);
        //return null;
    }).catch(function (err) {
        winston.error("Finding available channels failed with error: ", err);
    });

    parser.on('programme', function (programme) {
        // Do whatever you want with the programme
        var date1 = new Date(programme.start);
        var date2 = new Date(programme.end);
        var timeDiff = Math.abs(date2.getTime() - date1.getTime());
        var formdata = {};

        //if channel id availabe on our database
        if (channellist[programme.channel] !== undefined) {
            formdata.channel_number = channellist[programme.channel].channel_number;
            formdata.title = programme.title[0];
            formdata.timezone = 1;
            formdata.short_name = programme.title[0] || '';
            formdata.short_description = programme.channel || '';
            formdata.program_start = programme.start;
            formdata.program_end = programme.end;
            formdata.long_description = programme.desc[0] || '';
            formdata.duration_seconds = timeDiff / 1000;
            formdata.channels_id = channellist[programme.channel].channels_id;
            formdata.company_id = req.token.company_id;
            epgdata.push(formdata);
        }
    });

    parser.on('end', function (programme) {
        DBModel.bulkCreate(epgdata, {ignoreDuplicates: true})
            .then(function (data) {
                import_file_log.saved_records = data.length;
                import_log.push(import_file_log);
                callback(null);
            })
            .catch(function (err) {
                winston.error("Importing events failed with error: ", err);
                import_file_log.error_log = err;
                import_log.push(import_file_log);
                callback(null);
            });
    });
    //input.pipe(parser);
}

function import_xml_standard(req, res, current_time) {
    var message = '';
    var channel_list = new Array(); //associative array to contain title, with id as identifier for the channels
    try {
        var parser = new xml2js.Parser();
        fs.readFile(path.resolve('./public') + req.body.epg_file, req.body.encoding, function (err, data) {
            parser.parseString(data, function (err, result) {
                try {
                    var channels = result.tv.channel; //stores all channel records
                    var programs = result.tv.programme; //stores all programs of all channels
                    if (result.tv.channel != undefined && result.tv.programme != undefined) {
                        //channel and event data were not null / undefined
                        async.auto({
                            delete_existing_epg: function (callback) {
                                async.forEach(channels, function (channel, callback) {
                                    var filtered_channel_number = (req.body.channel_number) ? req.body.channel_number : {[Op.gte]: -1};
                                    var channel_name = (channel["display-name"][0]._) ? channel["display-name"][0]._ : channel["display-name"]
                                    DBChannels.findOne({
                                        attributes: ['channel_number'],
                                        where: {
                                            title: channel_name,
                                            channel_number: filtered_channel_number,
                                            company_id: req.token.company_id
                                        }
                                    }).then(function (ch_result) {
                                        if (ch_result) {
                                            db.models.epg_data.destroy({
                                                where: {
                                                    channel_number: filtered_channel_number,
                                                    program_start: {[Op.gte]: current_time},
                                                    company_id: req.token.company_id
                                                }
                                            }).then(function (result) {
                                                channel_list['' + channel.$.id + ''] = ({title: channel_name});
                                                callback(null, channel_list); //move control to next foreach iteration
                                            }).catch(function (error) {
                                                winston.error("Deleting previous events for specific channels failed with error: ", error);
                                                callback(true);//todo: provide some info to error
                                            });
                                        } else callback(null, channel_list); //move control to next foreach iteration
                                        return null;
                                    }).catch(function (error) {
                                        winston.error("Finding channel failed with error: ", error);
                                        callback(true); //todo: provide some info to error
                                    });
                                }, function (error) {
                                    if (error) {
                                        callback(true, 'Error step xxx');
                                    } //todo: proper message
                                    if (!error) {
                                        callback(null, channel_list)//move control to next function
                                    }
                                });
                                return null;
                            },
                            save_epg: ['delete_existing_epg', function (channels, callback) {
                                programs.forEach(function (program) {
                                    //the program object cannot be empty, the channel for this program should be in the file and should have passed the user filter
                                    if (program.$ != undefined && channel_list['' + program.$.channel + '']) {
                                        try {
                                            DBChannels.findOne({
                                                attributes: ['id', 'channel_number', 'title'],
                                                where: {
                                                    title: channel_list['' + program.$.channel + ''].title,
                                                    company_id: req.token.company_id
                                                }
                                            }).then(function (result) {
                                                //if channel info found, let's save the epg record
                                                if (result && ((req.body.channel_number === null) || (req.body.channel_number == result.channel_number))) {
                                                    //only insert future programs (where program_start > current)
                                                    if (moment(stringtodate(program.$.start)).subtract(req.body.timezone, 'hour').format('YYYY-MM-DD HH:mm:ss') > moment(current_time).format('YYYY-MM-DD HH:mm:ss')) {
                                                        var program_title = (program.title[0]._) ? program.title[0]._ : program.title[0];
                                                        var program_desc = (program.desc[0]._) ? program.desc[0]._ : program.desc[0];
                                                        db.models.epg_data.create({
                                                            channels_id: result.id,
                                                            channel_number: result.channel_number,
                                                            title: (program_title) ? program_title : "Program title",
                                                            short_name: (program_title) ? program_title : "Program name",
                                                            short_description: (program_desc) ? program_desc : "Program description",
                                                            program_start: moment(stringtodate(program.$.start)).subtract(req.body.timezone, 'hour'),
                                                            program_end: moment(stringtodate(program.$.stop)).subtract(req.body.timezone, 'hour'),
                                                            long_description: (program_desc) ? program_desc : "Program summary",
                                                            duration_seconds: datetimediff_seconds(stringtodate(program.$.start), stringtodate(program.$.stop)), //is in seconds
                                                            company_id: req.token.company_id
                                                        }).then(function (result) {
                                                            //on each write, do nothing. we wait for the saving process to finish
                                                        }).catch(function (err) {
                                                            //error while saving records
                                                            if (err.name === "SequelizeUniqueConstraintError") {
                                                                res.status(400).send({message: err.errors[0].message}); //other duplicate fields. return sequelize error message
                                                            } else {
                                                                winston.error("Saving event failed with error: ", err);
                                                                res.status(400).send({message: 'An error occurred while uploading EPG. ' + err.errors[0].message}); //another error occurred. return sequelize error message
                                                            }
                                                        });
                                                    }

                                                }
                                                return null;
                                            }).catch(function (error) {
                                                winston.error("Finding channel failed with error: ", error); //error while saving records
                                            });
                                        } catch (error) {
                                            //todo: display info that some data were not saved?
                                        }
                                    }
                                });
                            }]
                        }, function (error, results) {
                            if (error) {
                                return res.status(400).send({message: message}); //serverside filetype validation
                            } else return res.status(200).send({message: 'Epg records were saved'}); //serverside filetype validation
                        });

                    } //file records successfully read, and attempted to save them
                } catch (error) {
                    //error while trying to read the file. Probably it is empty or is missing the tv tags
                    message = 'Malformed file';
                }
            });
        });
        message = 'Epg records were saved';
        return res.status(200).send({message: message});
    } catch (error) {
        message = 'Unable to save the epg records';
        return res.status(400).send({message: message});
    }
}

function stringtodate(date) {
    return date.substring(0, 4) + '-' + date.substring(4, 6) + '-' + date.substring(6, 8) + ' ' + date.substring(8, 10) + ':' + date.substring(10, 12) + ':' + date.substring(12, 14);
}

function datetimediff_seconds(start, end) {
    return parseInt(moment(end).format('X')) - parseInt(moment(start).format('X')); //format('X') makes sure timestamps are in seconds
}
