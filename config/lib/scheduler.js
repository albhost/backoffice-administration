'use strict'

const Bull = require('bull');
const winston = require('winston');
const glob = require('glob');
const path  = require('path');
const config = require('../config');
const models = require('./sequelize').models;
const push_msg = require('../../custom_functions/push_messages');
const settings = require('../../custom_functions/settings');

var cronScheduler;
var crons = {}

var programScheduler;

function init() {
    let redisConfig = {
        host: config.redis.host,
        port: config.redis.port
    }

    if (config.redis.password) {
        redisConfig.password = config.redis.password;
    }

    programScheduler = new Bull('program:scheduler', {
        redis: redisConfig,
        defaultJobOptions: {
            attempts: 2,
            removeOnComplete: true
        }
    });

    programScheduler.process(async job => {
        return await processScheduledProgram(job.data)
    });

    cronScheduler = new Bull('scheduler:cron', {
        redis: redisConfig,
        defaultJobOptions: {
            attempts: 2
        }
    });

    cronScheduler.process(async job => {
        return await processCronJob(job)
    });

    loadCronJobs()
}

async function scheduleProgram(eventId, delay, loginId, programId) {
    if (delay <= 0) {
        throw new Error('Cannot schedule this event because time is negative');
    }

    const options = {
        jobId: eventId,
        delay: delay
    };

    const data = {
        eventId: eventId,
        delay,
        loginId,
        programId
    };

    return await programScheduler.add(data, options);
}

async function unscheduleProgram(eventId) {
    return programScheduler.getJob(eventId)
        .then(function(job) {
            if (!job) {
                return;
            }

            return job.isActive()
                .then(function(isActive) {
                    if (isActive) {
                        return;
                    }

                    return job.remove();
                });
        });
}

async function isScheduled (eventId) {
    return await isScheduledPromise(eventId);
}

function isScheduledPromise (eventId) {
    return programScheduler.getJob(eventId)
        .then(function(job) {
            if (!job) {
                return false;
            }

            return true;
        });
}

function processScheduledProgram(data) {
    return models.devices.findAll({
        attributes: ['googleappid', 'app_version', 'appid'],
        where: {login_data_id: data.loginId, device_active: true},
        include: [{model: models.login_data, attributes: ['username', 'company_id'], required: true}]
    }).then(function(devices) {
        if (devices && devices.length > 0) {
            let firebaseKey = settings.locals.backendsettings[devices[0].login_datum.company_id].firebase_key;
            return models.epg_data.findOne({
                attributes: ['id', 'channel_number', 'program_start', 'title', 'long_description'],
                where: {id: data.programId}
            }).then(function (epg_program) {
                if(!epg_program || epg_program.length<0){
                    winston.info("No EPG records found at schedule.")
                }
                else{
                    var min_ios_version = (company_configurations.ios_min_version) ? parseInt(company_configurations.ios_min_version) : parseInt('1.3957040');
                    var android_phone_min_version = (company_configurations.android_phone_min_version) ? parseInt(company_configurations.android_phone_min_version) : '1.1.2.2';
                    var min_stb_version = (company_configurations.stb_min_version) ? parseInt(company_configurations.stb_min_version) : '2.2.2';
                    var android_tv_min_version = (company_configurations.android_tv_min_version) ? parseInt(company_configurations.android_tv_min_version) : '6.1.3.0';
                    for(var i=0; i<devices.length; i++){
                        if(devices[i].appid === 1 && devices[i].app_version >= min_stb_version)
                            var message = new push_msg.SCHEDULE_PUSH(epg_program.title, epg_program.long_description, '2', "scheduling", data.programId.toString(), epg_program.channel_number.toString(), data.delay.toString());
                        else if(devices[i].appid === 2 && devices[i].app_version >= android_phone_min_version){
                            var message = new push_msg.SCHEDULE_PUSH(epg_program.title, epg_program.long_description, '2', "scheduling", data.programId.toString(), epg_program.channel_number.toString(), data.delay.toString());
                        }
                        else if(parseInt(devices[i].appid) === parseInt('3') && parseInt(devices[i].app_version) >= min_ios_version)
                            var message = new push_msg.SCHEDULE_PUSH(epg_program.title, epg_program.long_description, '2', "scheduling", data.programId.toString(), epg_program.channel_number.toString(), data.delay.toString());
                        else if(devices[i].appid === 4 && devices[i].app_version >= android_tv_min_version)
                            var message = new push_msg.SCHEDULE_PUSH(epg_program.title, epg_program.long_description, '2', "scheduling", data.programId.toString(), epg_program.channel_number.toString(), data.delay.toString());
                        else if(['5', '6'].indexOf(devices[i].appid))
                            var message = new push_msg.SCHEDULE_PUSH(epg_program.title, epg_program.long_description, '2', "scheduling", data.programId.toString(), epg_program.channel_number.toString(), data.delay.toString());
                        else var message = {
                                "event": "scheduling",
                                "data.programId": data.programId.toString(),
                                "channel_number": epg_program.channel_number.toString(),
                                "data.delay": data.delay.toString(),
                                "program_name": epg_program.title,
                                "description": epg_program.long_description
                            };
                        push_msg.send_notification(devices[i].googleappid, firebaseKey, devices[0].login_datum.username, message, 0, true, false, 0);
                    }
                }
            }).catch(function(error) {
                winston.error("Searching for the event failed with error: ", error);
            });
        }
    }).catch(function(error) {
        winston.error("Searching for devices failed with error: ", error);
    });
}

async function processCronJob(job) {
    let cronName = job.opts.repeat.jobId;
    let cronDef = crons[cronName];

    if (!cronDef) {
        winston.error("No cron job definition found. Removing job");
        await cronScheduler.removeRepeatable({cron: job.opts.repeat.cron, jobId: cronName});
    }

    await cronDef.routine()
}

async function loadCronJobs() {
    let basePath = './config/crons/';

    let matches = glob.sync(`*.cron.js`, {
        cwd: path.resolve(basePath),
        matchBase: true
    });

    if (!matches) {
        return;
    }

    for (let match of matches) {
        let jobDefPath = path.resolve(basePath + match);
        let jobDef = require(jobDefPath);
        await addCronJob(jobDef);
    }
}

async function addCronJob(cron) {
    if (!cron.name) {
        throw new Error('Cron job must have a name')
    }

    if (!cron.cronExp) {
        throw new Error('Cron job must have cronExp which tells bull how job will be repeated')
    }

    if (!cron.routine) {
        throw new Error('Cron job must have a routine function')
    }

    if (cron.routine.constructor.name !== 'AsyncFunction') {
        throw new Error('Cron job prcess function should be async')
    }

    if (crons[cron.name]) {
        throw new Error('Cannot add cron jobs with same name')
    }

    crons[cron.name] = cron;

    let opts = {
        repeat: {
            jobId: cron.name,
            cron: cron.cronExp
        }
    }

    await cronScheduler.add({}, opts);
}

module.exports = {
    init,
    scheduleProgram,
    unscheduleProgram,
    isScheduled,
    isScheduledPromise
}
