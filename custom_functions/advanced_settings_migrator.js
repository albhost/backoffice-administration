'use strict'

const jsonpath = require('jsonpath');

exports.migrate = function (queryInterface, options) {
    return new Promise(function (resolve, reject) {
        if (!queryInterface) {
            reject(new Error('Query interface is null'));
            return;
        }

        if (!options || !options.path || !options.operation) {
            reject(new Error('Options object should have path, and value'));
            return;
        }

        if (!options.name) {
            reject(new Error('Name undefined'));
            return;
        }

        if (options.operation == 'add') {
            if (!options.value) {
                reject(new Error('Value undefined'));
                return;
            }
        }
        else if (options.operation != 'remove') {
            reject(new Error('Operation must be add or remove. Other operations are not supported'))
        }

        queryInterface.sequelize.query("SELECT id, data from advanced_settings WHERE id>0")
            .then(function (rows) {

                let promises = [];
                const parentPath = options.path != '.' ? '$.' + options.path : '$';
                const path = parentPath + '.' + options.name;

                if (options.operation == 'add') {

                    for (const element of rows[0]) {
                        let advancedSettings = JSON.parse(element.data)

                        if (options.path != '.') {
                            //check path exist
                            let paths = jsonpath.paths(advancedSettings, path)
                            if (paths.length > 0) {
                                reject(new Error('Property already exist'));
                                break;
                            }

                            //Get parent value
                            let value = jsonpath.value(advancedSettings, parentPath);
                            value[options.name] = options.value;
                            jsonpath.apply(advancedSettings, parentPath, function (v) {
                                return value;
                            });
                        }
                        else {
                            if (advancedSettings[options.name]) {
                                reject(new Error('Property already exist'));
                                return;
                            }

                            advancedSettings[options.name] = options.value;
                        }

                        promises.push(queryInterface.bulkUpdate('advanced_settings', {
                            data: JSON.stringify(advancedSettings)
                        }, { id: element.id }));
                    }
                }
                else {
                    //We are deleting a field
                    for (const element of rows[0]) {
                        let advancedSettings = JSON.parse(element.data)
                        if (options.path != '.') {
                            //check path exist
                            let paths = jsonpath.paths(advancedSettings, path)
                            if (paths.length == 0) {
                                reject(new Error('Property do not exist'));
                                break;
                            }

                            //Get parent value
                            let value = jsonpath.value(advancedSettings, parentPath);
                            delete value[options.name];

                            jsonpath.apply(advancedSettings, parentPath, function (v) {
                                return value;
                            });
                        }
                        else {
                            if (!advancedSettings[options.name]) {
                                reject(new Error('Property do not exist'));
                                return
                            }

                            delete advancedSettings[options.name];
                        }

                        promises.push(queryInterface.bulkUpdate('advanced_settings', {
                            data: JSON.stringify(advancedSettings)
                        }, { id: element.id }));
                    }
                }

                Promise.all(promises)
                    .then(function () {
                        resolve();
                    }).catch(function (err) {
                        reject(err);
                    })
            });
    });
}
