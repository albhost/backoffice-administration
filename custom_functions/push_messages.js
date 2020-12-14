const path = require('path');
const db = require(path.resolve('./config/lib/sequelize')).models;
const winston = require('../config/lib/winston');
const axios = require('axios').default;

function send_notification(fcm_token, firebase_key, user, message, ttl, push_message, save_message, id, callback) {
    //push payload is the same inside this function call
    if (message.data) {
        var is_info = (message.data.type === '1') ? true : false;
        var options = {
            url: 'https://fcm.googleapis.com/fcm/send',
            method: 'POST',
            headers: {
                'Authorization': "key=" + firebase_key,
                'Content-Type': 'application/json'
            },
            data: JSON.stringify({
                to: fcm_token,
                data: message.data,
                notification: message.notification
            })
        };
    } else {
        var is_info = (push_message && save_message) ? true : false;
        var payload = {
            "push_message": (push_message) ? "true" : "false",
            "EVENT": (message.event) ? message.event : "",
            "PROGRAM_ID": (message.event) ? message.program_id : "",
            "CHANNEL_NUMBER": (message.event) ? message.channel_number : "",
            "EVENT_TIME": (message.event) ? message.event_time : "",
            "program_name": (message.event) ? message.program_name : "",
            "program_description": (message.event) ? message.description : "",

            "COMMAND": (!push_message && message.command) ? message.command : "",
            "SOFTWARE_INSTALL": (!push_message && message.software_install) ? message.software_install : "",
            "DELETE_SHP": (!push_message && message.delete_shp) ? message.delete_shp : "",
            "DELETE_DATA": (!push_message && message.delete_data) ? message.delete_data : "",
            "URL_DOWNLOAD": "",
            "NAME": "",
            "ACTION": (message.action) ? message.action : "",
            "PARAMETER1": (message.parameter1) ? message.parameter1 : "", //param 1
            "PARAMETER2": (message.parameter2) ? message.parameter2 : "", //param 2
            "PARAMETER3": (message.parameter3) ? message.parameter3 : "" //options
        };

        //prepare request
        var options = {
            url: 'https://fcm.googleapis.com/fcm/send',
            method: 'POST',
            headers: {
                'Authorization': "key=" + firebase_key,
                'Content-Type': 'application/json'
            },
            data: JSON.stringify({
                to: fcm_token,
                data: payload
            })
        };
    }

    axios(options).then(response => {
        if (response.data && is_info === true) {
            if (response.data && response.data.success === 1) {
                var title = (!message.data) ? message.parameter1 : message.data.title;
                var description = (!message.data) ? message.parameter2 : message.data.body;
                exports.save_message(user, fcm_token, description, push_message, title); //save record for sent info messages
            }
        }
        else if (response.data && is_info === false && message.data.values !== undefined && message.data.values.activity === 'subscription_notification') {
            exports.save_notification(user, fcm_token, message.data.body, push_message, message.data.title); //save record for sent info messages
        }
        else if (response.data && is_info === false && ((message.data.type === 'imageandtext') || (message.data.type === 'textonly') || (message.data.type === 'imageonly'))) {
            exports.save_banner(id, fcm_token, description, push_message, title); //save record for sent info messages
        }
    }).catch(error => {
        winston.error("Error sending the push notification: ", error.message)
    })
}


function save_message(user, googleappid, message, action, title, company_id){

    db.messages.create({
        username: user,
        googleappid: googleappid,
        message: message,
        action: action,
        title: title,
        company_id: company_id
    }).then(function(result) {
        winston.info('Push notifications saved');
    }).catch(function(err) {
        winston.error("Error at creating push notification, error: ", err);
    });

}


function save_notification(user, googleappid, message, action, title, company_id){
   db.notifications.create({
        username: user,
        googleappid: googleappid,
        message: message,
        action: action,
        title: title,
        company_id: company_id
    }).then(function(result) {
        winston.info('Push notifications saved');
    }).catch(function(err) {
        winston.error("Error at creating push notification, error: ", err);
    });

}

function save_banner(id , googleappid, company_id, status, action){
    db.commands.create({
        login_data_id: id,
        googleappid: googleappid,
        status: status,
        action: action,
        command: 1,
        company_id: company_id
    }).then(function(result) {
        winston.info('Push notifications saved for banners ');
    }).catch(function(err) {
        winston.error("Error at creating push notification, error: ", err);
    });
}

function INFO_PUSH(title, body, type, parameters){
    return {
        data: {
            title   : title,
            body    : body,
            type    : type,
            values  : parameters
        },
        notification : {
            title   : title,
            body    : body
        }
    }
}

function SCHEDULE_PUSH(title, body, type, event, program_id, channel_number, event_time) {
    return {
        data: {
            title   : title,
            body    : body,
            type    : type,
            values  : {
                event          : event,
                program_id     : program_id,
                channel_number : channel_number,
                event_time     : event_time
            }
        },
        notification:  {
            title   : title,
            body    : body
        }
    };
}

function CUSTOM_TOAST_PUSH(title, message, type, imageUrl, duration, activity) {
    return {
        data: {
            title: title,
            body: message,
            type: type,
            imageurl: imageUrl,
            duration: duration,
            activity: activity
        },
        notification: {
            title: title,
            body: message
        }
    };
}

function COMMAND_PUSH(title, body, type, command, param1, param2, param3) {
    return {
        data: {
            title   : title,
            body    : body,
            type    : type,
            values  : {
                command : command,
                parameter1  : (param1 && param1 !== null) ? param1 : '',
                parameter2  : (param2 && param2 !== null) ? param2 : '',
                parameter3  : (param3 && param3 !== null) ? param3 : ''
            }
        },
        notification: {
            title   : title,
            body    : body
        }
    };
}

function ACTION_PUSH(title, body, type, action, parameters) {
    return {
        data: {
            title   : title,
            body    : body,
            type    : type,
            values  : {
                action : action,
                parameters : parameters
            }
        },
        notification: {
            title   : title,
            body    : body
        }
    };
}

exports.send_notification = send_notification;
exports.save_message = save_message;
exports.save_banner = save_banner;
exports.save_notification = save_notification;
exports.INFO_PUSH = INFO_PUSH;
exports.SCHEDULE_PUSH = SCHEDULE_PUSH;
exports.CUSTOM_TOAST_PUSH = CUSTOM_TOAST_PUSH;
exports.COMMAND_PUSH = COMMAND_PUSH;
exports.ACTION_PUSH = ACTION_PUSH;