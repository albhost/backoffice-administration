"use stric"

const { createStorage } = require('../config/lib/storage_manager');

var path = require('path'),
    winston = require('winston'),
    redis = require(path.resolve('./config/lib/redis')),
    db = require(path.resolve('./config/lib/sequelize')).models,
    vmx = require('../modules/vmx/lib/vmx');

const KEY_ADVANCED_POSTFIX = ':company_advanced_settings';
const KEY_COMPANY_SETTINGS_POSTFIX = ':company_settings';
var locals;

module.exports.setCompanySettings = function(newSettings, clean, setUpdatedFlag) {
    if (clean) {
        delete locals.backendsettings[newSettings.id];
    }

    locals.backendsettings[newSettings.id] = newSettings;

    if (setUpdatedFlag) {
        locals.backendsettings[newSettings.id].already_updated = true;
    }

    return new Promise(function (resolve, reject) {
        let settingsJson = newSettings.toJSON();
        let key = newSettings.id + KEY_COMPANY_SETTINGS_POSTFIX;
        redis.client.set(key, JSON.stringify(settingsJson), function (err) {
            if (err) {
                reject(err)
            } else {
                resolve()
            }
        });
    })
}

module.exports.updateCompanySettings = function(newSettings) {
    return new Promise((resolve, reject) => {
        this.setCompanySettings(newSettings, true, true)
        .then(function(){
            redis.client.publish('event:company_settings_updated', newSettings.id);
            resolve();
        })
        .catch(function(err) {
            reject(err);
        });
    })
}

module.exports.setAdvancedSettings = function (newAdvancedSettings, clean, setUpdatedFlag) {
    if (clean) {
        delete locals.advanced_settings[newAdvancedSettings.company_id];
    }

    let settingsJson = newAdvancedSettings.data;
    locals.advanced_settings[newAdvancedSettings.company_id] = settingsJson;
    
    createStorage(settingsJson.google_cloud, newAdvancedSettings.company_id);

    if (setUpdatedFlag) {
        locals.advanced_settings[newAdvancedSettings.company_id].already_updated = true;
    }

    return new Promise(function (resolve, reject) {
        let key = newAdvancedSettings.company_id + KEY_ADVANCED_POSTFIX;
        redis.client.set(key, JSON.stringify(settingsJson), function (err) {
            if (err) {
                reject(err)
            } else {
                if (settingsJson.vmx) {
                    createVmxClient(newAdvancedSettings.company_id, settingsJson.vmx);
                }
                
                resolve()
            }
        });
    })
}

module.exports.updateAdvancedSettings = function (updatedAdvancedSettings) {
    return new Promise((resolve, reject) => {
        this.setAdvancedSettings(updatedAdvancedSettings, true, true)
        .then(function(){
            redis.client.publish('event:company_advanced_settings_updated', updatedAdvancedSettings.company_id);
            resolve();
        })
        .catch(function(err) {
            reject(err);
        })
    })
}

module.exports.loadAdvancedSettings = function () {
    return new Promise((resolve, reject) => {
        let subscriber = redis.client.duplicate();
        subscriber.on('message', function(channel, message) {
            winston.info('Advanced settings of company with id: ' + message + ' updated')
            redis.client.get(message + KEY_ADVANCED_POSTFIX, function(err, rawSettings) {

                if(!locals.advanced_settings[message].already_updated) {
                    let settingsJson = JSON.parse(rawSettings);
                    delete locals.advanced_settings[message];
                    locals.advanced_settings[message] = settingsJson;
                    if (settingsJson.vmx) {
                        createVmxClient(message, settingsJson.vmx);
                    }
                }
                else {
                    delete locals.advanced_settings[message].already_updated;
                }
            });
        });

        subscriber.subscribe('event:company_advanced_settings_updated');

        return db.advanced_settings.findAll().then((result) => {
            let loadPromises = [];
            for (let i = 0; i < result.length; i++) {
                loadPromises.push(this.setAdvancedSettings(result[i], false, false))
            }

            return Promise.all(loadPromises)
                .then(function() {
                    resolve();
                })
                .catch(function (err) {
                    reject(err)
                });
        });
    });
}

function createVmxClient(companyID, vmxConfig) {
    let vmxOptions = {
        tenantId: vmxConfig.tenant_id,
        companyName: vmxConfig.company_name,
        auth: {
            username: vmxConfig.username,
            password: vmxConfig.password
        }
    }

    vmx.createClient(companyID, vmxOptions);
}

module.exports.loadCompanySettings = function() {
    return new Promise((resolve, reject) => {
        let subscriber = redis.client.duplicate();
        subscriber.on('message', function(channel, message) {
            winston.info('Settings of company with id: ' + message + ' updated')
            redis.client.get(message + ':company_settings', function(err, raw_company_settings) {
                let company_settings = JSON.parse(raw_company_settings);
                if(!locals.backendsettings[message].already_updated) {
                    let expire_date = new Date(company_settings.expire_date);
                    delete company_settings.expire_date;
                    company_settings.expire_date = expire_date;
                    delete locals.backendsettings[message];
                    locals.backendsettings[message] = company_settings;
                }
                else {
                    delete locals.backendsettings[message].already_updated;
                }
            });
        });

        subscriber.subscribe('event:company_settings_updated');

        db.settings.findAll()
            .then((result) => {
                let loadPromises = [];
                for (let i = 0; i < result.length; i++) {
                    loadPromises.push(this.setCompanySettings(result[i], false, false))
                }

                return Promise.all(loadPromises)
                    .then(function() {
                        resolve();
                    })
                    .catch(function (err) {
                        reject(err)
                    });
            })
    })
}

module.exports.init = function(app) {
    locals = app.locals;
    locals.backendsettings = {};
    locals.advanced_settings = {};

    this.locals = locals
}

module.exports.locals = null;