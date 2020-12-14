'use strict'

const VmxClient = require('./vmx_client');

var clients = {};

/**
 * Get client by tag
 * @param {String} tag Tag is used an id to store the client
 * @returns {VmxClient}
*/
function getClient(tag) {
    let client = clients[tag];

    if (!client) {
        throw new Error('Client with given tag not found');
    }

    return client;
}

/**
* Create a vmx client for making requests towards VMX Cloud
* @param {Object} options VMX cloud config
* @param {Integer} options.tenantId Tenant id
* @param {String} options.companyName Operating company name
* @param {Object} options.auth Auth
* @param {String} options.auth.username Auth username
* @param {String} options.auth.password Auth password
*/
function createClient(tag, options) {
    let client = new VmxClient(options);
    clients[tag] = client;

    return client;
}

module.exports = {
    createClient,
    getClient
}