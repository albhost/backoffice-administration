const path = require('path'),
    errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller')),
    winston = require('winston'),
    push_msg = require(path.resolve('./custom_functions/push_messages')),
    db = require(path.resolve('./config/lib/sequelize')).models,
    DBDevices = db.devices;

const moment = require('moment');
const { Op } = require('sequelize');
const escape = require(path.resolve('./custom_functions/escape'));

/**
 * @api {post} /api/notification Push messages - Send subscription message
 * @apiVersion 0.2.0
 * @apiName Send subscription message
 * @apiGroup Backoffice
 * @apiHeader {String} authorization Token string acquired from login api.
 * @apiParam {Number} username  Field username.  If all_users is true, username can be left empty and is ignored.
 * @apiParam {boolean} all_users  Mandatory field all_users. Overrules field username.
 * @apiParam {Number[]} appid  Mandatory field appid. Cannot be an empty array.
 * @apiParam {String} title  Optional field title.
 * @apiParam {String} message  Optional field message.
 * @apiParam {Number} duration  Optional field duration, in milliseconds. If empty, default value is 5000ms.
 * @apiParam {String} imageGif  Mandatory field imageGif.
 * @apiParam {String} link_url  Optional field link_url.
 * @apiParam {Datetime} delivery_time  Optional field delivery_time. If missing, the ad will be sent immediately
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "message": "The subscription message will be sent in YYYY-MM-DD HH:mm:ss"
 *      }
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 400 OK
 *     {
 *       "message": "Error message" //for the actual message refer to list below
 *     }
 *
 *      "You did not select any device types" //appid is missing, empty or invalid
 *      "You have to add an image link for the subscription message" //imageGif is missing, empty or invalid
 *      "You did not select any devices" //username is missing, empty or invalid and all_users is missing, empty, invalid or false
 *      "You must select where the subscription message should appear" //activity is missing, empty or invalid
 *

 */

exports.create = function(req, res) {
    var no_users = (req.body.usertype === "one" && req.body.username === null) ? true : false; //no users selected for single user messages, don't send push

    if (no_users) {
        return res.status(400).send({
            message: 'You did not select any devices'
        });
    } else {
        var where = {}; //the device filters will be passed here
        if (req.body.usertype === "one") where.login_data_id = req.body.username; //if only one user is selected, filter devices of that user
    }

        var title = (req.body.title) ? req.body.title : "";
    var message = (req.body.message) ? req.body.message : "";
    var activity = "subscription_notification";
    var yOffset = 1;
    var xOffset = 1;
    var duration = (req.body.duration) ? req.body.duration.toString() : "5000"; //default value 5000ms
    var link_url = (req.body.link_url) ? req.body.link_url : "";
    var imageGif = (req.body.imageGif) ? req.body.imageGif : "";
    var type = (req.body.type) ? req.body.type : 'textonly';
    var delivery_time = (!req.body.delivery_time) ? 0 : moment(req.body.delivery_time).format('x') - moment(Date.now()).format('x');
    if(req.body.activity) {
        var activity = "";
        for(var i=0; i<req.body.activity.length; i++) activity = (i<req.body.activity.length-1) ? (activity+req.body.activity[i]+",") : (activity+req.body.activity[i]);
        if(activity.search("all") !== -1) activity = "all"; //"all" overules other activities
    }

    if (req.body.appid && req.body.appid.length > 0) {
        var device_types = [];
        for(var j=0; j<req.body.appid.length; j++) device_types.push(parseInt(req.body.appid[j]));
    }
    else return res.status(400).send({ message: "You did not select any device types" });

    if(!req.body.imageGif) res.status(400).send({ message: "You have to add an image link for the ad" });
    else var imageGif = req.body.imageGif;

    var no_users = !!(req.body.all_users !== true && req.body.username === null); //no users selected, don't send push
    var no_device_type = !!(!device_types || device_types.length < 1); //no device types selected, don't send push
    if(no_users || no_device_type){
        return res.status(400).send({
            message: 'You did not select any devices'
        });
    }
    else{
        var where = {}; //the device filters will be passed here
        if(req.body.all_users !== true) where.login_data_id = req.body.username; //if only one user is selected, filter devices of that user
        where.appid = {[Op.in]: device_types};
        where.device_active = true;  //ads only sent to logged users

        setTimeout(function(){

            send_notification(where, title, message,  imageGif, xOffset, yOffset, duration, link_url, activity, req.app.locals.backendsettings[req.token.company_id].firebase_key, res, type);
        },delivery_time);

               return res.status(200).send({
                    message: 'The subscription message will be sent in '+moment(req.body.delivery_time).format("YYYY-MM-DD HH:mm:ss")
                });
    }

};



//returns list of commands stored in the database, for the listView
exports.list = function(req, res) {

    var qwhere = {},
        final_where = {},
        query = req.query;

    //start building where
    final_where.where = qwhere;
    if (parseInt(query._start)) final_where.offset = parseInt(query._start);
    if (parseInt(query._end)) final_where.limit = parseInt(query._end) - parseInt(query._start);
    if(query._orderBy) final_where.order = [[escape.col(query._orderBy), escape.orderDir(query._orderDir)]];


    final_where.include = [];

    final_where.where.company_id = req.token.company_id; //return only records for this company
    db.notifications.findAndCountAll(
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
        winston.error("Getting message list failed with error: ", err);
        res.jsonp(err);
    });


};

function send_notification(where, title, message,  imageGif, xOffset, yOffset, duration, link_url, activity, firebase_key, res, type){
    DBDevices.findAll(
        {
            attributes: ['googleappid', 'app_version', 'appid'],
            where: where,
            include: [{model: db.login_data, attributes: ['username', 'id'], required: true, raw: true, where: {get_messages: true}}]
        }
    ).then(function(devices) {
        if (!(!devices || devices.length === 0)) {
            for(let i=0; i<devices.length; i++){
                const push_object = new push_msg.CUSTOM_TOAST_PUSH(title, message, type, imageGif, duration, activity);
                push_msg.send_notification(devices[i].googleappid, firebase_key, devices[i].login_datum.dataValues.username, push_object, 5, true, true, devices[i].login_datum.dataValues.id ,function(devices) {
                    console.log("We are here at ad callback", devices)
                });
            }
        }


    });
}
