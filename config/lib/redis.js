var path = require('path'),
    RedisServer = require('redis-server'),
    download = require('download'),
    fs = require('fs-extra'),
    winston = require('./winston'),
    redis = require('redis'),
    extractZip = require('extract-zip');
    
var binName;
var dir = './bin/redis';

var subscriberClient = null;

module.exports.startServer = function(config, callback) {
    if (process.platform == 'win32') {
        binName = 'redis-server.exe';
        if (!fs.existsSync(dir)) {
            winston.info('Redis is missing! Downloading');
            getRedisFromLocalCopy();
        }
        else {
            start();
        }    
    } else {
        binName = 'redis-server';
        if (!fs.existsSync(dir)) {
            winston.info('Redis is missing! Downloading');
            getRedisFromLocalCopy();
        }
        else {
            start();
        }    
    }
    
    function downloadRedis(downloadUrl) {
        const ext = path.extname(downloadUrl);
        const filename = 'redis-server' + ext;
    
        download(downloadUrl).then( async (data) => {
            // noinspection JSAnnotator
            fs.writeFileSync('./redis/' + filename, data, {mode: 0775});
            if (ext == '') {
                start();
                return;
            } 
            else if (ext == '.zip') {
                //unzip to redis folder and cleanup
                try {
                    const directory  = path.resolve('./redis');
                    await extractZip('./redis/' + filename, {dir: directory})
                    winston.info('Redis download complete');
                    start();
                } catch (error) {
                    callback(err);
                    return;
                }
            }
        })
    }

    function getRedisFromLocalCopy() {
        winston.info("Getting redis from local stock");
        
        if (!fs.existsSync('./bin')) {
            fs.mkdirSync('./bin');

            fs.mkdirSync(dir);
        }
        else {
            fs.mkdirSync(dir);
        }

        const source = './public/files/redis/'
        if(process.platform == 'win32') {
            const dir  = path.resolve('./bin/redis');
            extractZip(source + 'redis-win.zip', {dir: dir}, function(err) {
                if (err) {
                    callback(err);
                    return;
                }

                winston.info('Redis install complete');
                start()
            });
        } else {
            let version = process.platform == 'darwin' ? 'redis-darwin': 'redis-linux';
            fs.copySync(source + version, dir + '/' + binName);
            // noinspection JSAnnotator
            fs.chmodSync(dir + '/' + binName, 0775);

            start();
        }
    }
    
    function start () {
        const server = new RedisServer({
            port: config.port,
            bin: dir + '/' + binName
        });
    
        server.open((error) => {
            if (error) {
                callback(error);
                return;
            }

            winston.info('Redis server started');
            callback(null);
        });
    }    
}

module.exports.createClient = function(config) {
    let c = {
        host: config.host,
        port: config.port,
        db: config.database
    }

    if (config.embedded == false) {
        //Redis is external
        if (config.password) {
            c.password = config.password;
        }
    }

    this.client = redis.createClient(c)
    
    this.client.on('error', function(error){
        winston.error("Redis error: " + error);
    });
}

module.exports.client = null;

module.exports.getSubscriberClient = function() {
    if (subscriberClient) {
        return subscriberClient;
    }

    if (!this.client) {
        throw new Error('There is no existing connection to redis server that can be duplicated');
    }

    subscriberClient = this.client.duplicate();
    return subscriberClient;
}