"use strict";

var eventSystem = require('./event_system'),
    db = require('./sequelize').models,
    redis = require('./redis'),
    axios = require('axios'),
    winston = require('winston');

const EventSyncName = 'sync_webhook_event';

function initWebhooks(app) {
    //Subscribe to redis channel
    let subscriber = redis.getSubscriberClient();
    subscriber.on('message', function(channel, message) {
        if (channel != EventSyncName) {
            return;
        }

        //metadata string format
        //company_id:event:action
        let metadata = message.split(':');
        if (metadata.length != 3) {
            winston.error('Failed to sync webhook event system due to mailformed message');
        }

        let companyId = parseInt(metadata[0]);
        let eventType = metadata[1];
        let action = metadata[2];
        let eventTypes = eventType.split(',');

        winston.info('Syncing webhook for company: ' + companyId + ' event: ' + eventType + ' action: ' + action);

        if (action == 'subscribe') {
            for (let type of eventTypes) {
                registerWebhookEvent(companyId, type);
            }
        }
        else if (action == 'unsubscribe') {
            for (let type of eventTypes) {
                unRegisterWebhookEvent(companyId, type);
            }
        }
        else {
            winston.error('Failed to sync webhook events')
        }
    });

    subscriber.subscribe(EventSyncName);

    db.webhooks.findAll({
        where: {enable: true}
    }).then(function(webhooks) {
        webhooks.forEach(webhook => {
            webhook.events.forEach(event => {
                registerWebhookEvent(webhook.company_id, event);
            })
        });
    })
}

function registerWebhookEvent(companyID, eventType) {
    eventSystem.subscribe(companyID, eventType, onEvent)
}

function unRegisterWebhookEvent(companyID, eventType) {
    eventSystem.unSubscribe(companyID, eventType, onEvent);
}

function onEvent(companyID, eventType, args) {
    db.webhooks.findOne({
        where: {company_id: companyID, enable: true}
    }).then(function(webhook) {
        if (!webhook || webhook.events.indexOf(eventType) == -1) {
            //todo unsubscribe
            return;
        }

        sendWebhook(webhook.url, eventType, args);
    })
}

function sendWebhook(url, eventType, data) {
    let webhookEvent = {
        version: '0.1',
        event_type: eventType,
        data: data
    }

    axios.post(url, webhookEvent)
        .catch(function(err) {

        });
}

module.exports = {
    initWebhooks: initWebhooks,
    registerWebhook: registerWebhookEvent,
    unRegisterWebhook: unRegisterWebhookEvent
}