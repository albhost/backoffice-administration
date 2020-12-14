'use strict';

const axios = require('axios');

async function downloadToStorage(url, storage, storePath) {
    console.log(storePath);
    let response = await axios({
        url,
        method: 'GET',
        responseType: 'stream'
    });

    await storage.addFileFromReadable(response.data, storePath);
}

module.exports = {
    downloadToStorage
}