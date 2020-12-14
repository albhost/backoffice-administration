'use strict'

function sendError(req, res, statusCode, errorCode) {
    let language = req.body.language ? req.body.language : 'eng';
    
    let response = {
        error: {
            code: errorCode,
            message: (languagesV4[language]) ? languagesV4[language].language_variables[errorCode.toString()] : languagesV4['eng'].language_variables[errorCode.toString()]
        }
    }

    res.status(statusCode);
    res.send(response);
}

function sendData (req, res, data, cacheHeader) {
    let response = {
        data: data
    }

    if (cacheHeader) {
        res.setHeader('cache-control', cacheHeader);
    }

    res.send(response);
}

module.exports = {
    sendData: sendData,
    sendError: sendError
}