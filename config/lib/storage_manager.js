'use strict';

const {Storage, StorageType} = require('@tweedegolf/storage-abstraction');
const path = require('path');
const fs = require('fs-extra');
var storages = {};

/**
 * Get storage for a company.
 * @param {Number} companyId Company id.
 * @returns {Storage} storage
 */
async function getStorage(companyId) {
    let storage = storages[companyId];
    if (!storage) {
        throw new Error('Storage for that company does not exists');
    }

    return storage;
}

/**
 * Create storage service for company.
 * @param {Object} config Config.
 * @param {Number} companyId Company identifier.
 * @param {Boolean} forceSync If true overwrite necessary files that should be written
 * in disk storage like gcs project key json file.
 */
async function createStorage(config, companyId, forceSync) {
    let storageType = config.storage === true ? StorageType.GCS : StorageType.LOCAL;
    let options = {
        type: storageType,
        slug: false
    }

    if (storageType == StorageType.GCS) {
        options.projectId = config.projectId;
        options.bucketName = config.bucket_name;

        const keyFilePath = writeGCProjectKeyFile(config.google_managed_key, companyId, forceSync);
        options.keyFilename = keyFilePath;
    }
    else {
        options.directory = 'public';
    }

    
    let storage = new Storage(options);

    //Due to bug slug is not set properly in the adapter
    storage.adapter.slug = false;
    await storage.init();
    
    storages[companyId] = storage;
}

function writeGCProjectKeyFile(keyFileContent, companyId, overwrite) {
    const keyFilePath = path.resolve(`./public/${companyId}/google_project_key.json`);
    const exist = fs.existsSync(keyFilePath);

    if (!exist || overwrite) {
        fs.writeFileSync(keyFilePath, keyFileContent, {flag: 'wx'});
    }

    return keyFilePath;
}

function init() {

}

module.exports = {
    init,
    createStorage,
    getStorage
}