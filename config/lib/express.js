'use strict';

/**
 * Module dependencies.
 */
require('dotenv').config();
const config = require('../config'),
    express = require('express'),
    bodyParser = require('body-parser'),
    cookieParser = require('cookie-parser'),
    helmet = require('helmet'),
    consolidate = require('consolidate'),
    path = require('path'),
    fs = require('fs'),
    winston = require('./winston'),
    cors = require('cors'),
    rateLimit = require('express-rate-limit'),
    securityConfig = require('../security/exprees.security.config'),
    morgan = require('morgan'),
    url = require('url'),
    scheduler = require('./scheduler');

const responseV4 = require("../../modules/device-api-v4/server/utils/response")

//language configuration parameters
global.languages = {};
global.languagesV4 = {};
const language_folder_path = './config/languages/';
const language_folder_pathV4 = './config/languagesV4/';
global.vod_list = {};
global.company_configurations = {};
global.livetv_s_subscription_end = [];
global.livetv_l_subscription_end = [];
global.vod_s_subscription_end = [];
global.vod_l_subscription_end = [];

const dbColNameRegex = /^[a-zA-Z]+(_[a-zA-Z]+)*$/;
const validOrderDir = ['ASC', 'DESC'];

/**
 * Initialize local variables
 */
module.exports.initLocalVariables = function (app) {
    winston.info('Initializing LocalVariables...');
    // Setting application local variables
    app.locals.title = config.app.title;
    app.locals.description = config.app.description;
    if (config.secure && config.secure.ssl === true) {
        app.locals.secure = config.secure.ssl;
    }
    app.locals.keywords = config.app.keywords;
    app.locals.googleAnalyticsTrackingID = config.app.googleAnalyticsTrackingID;

    app.locals.logo = config.logo;
    app.locals.favicon = config.favicon;
    app.locals.usersProfileDir = config.app.usersProfileDir;
    app.locals.reCaptchaSecret = config.app.reCaptchaSecret;
    app.locals.livereload = config.livereload;


    process.env.JWT_SECRET =
      "YOUR_SECRET_KEY";
    process.env.JWT_ISSUER = "Magoware";
};

/**
 * Initialize application middleware
 */
module.exports.initMiddleware = function (app) {
    winston.info('Initializing Middleware...');

    // Passing the request url to environment locals
    app.use(function (req, res, next) {
        res.locals.host = req.protocol + '://' + req.hostname;
        res.locals.url = req.protocol + '://' + req.headers.host + req.originalUrl;
        app.locals.originUrl = req.protocol + '://' + req.headers.host;
        next();
    });

    // Showing stack errors
    app.set('showStackError', true);

    // Enable jsonp
    app.enable('jsonp callback');

    app.enable('trust proxy');

    // Environment dependent middleware
    if (process.env.NODE_ENV === 'development') {
        app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));

        // Disable views cache
        app.set('view cache', false);
    } else
        if (process.env.NODE_ENV === 'production') {
            app.locals.cache = 'memory';
        }

    if (securityConfig.rate_limit.enabled) {
        //Add rate req limit
        const limiter = rateLimit({
            windowMs: 60 * 1000, // 15 minutes
            max: securityConfig.rate_limit.max_request_min, // limit each IP to 100 requests per windowMs
            handler: function(req, res, next) {
                //Check route white list
                let pathName = url.parse(req.originalUrl).pathname;

                let whiteRoutes = securityConfig.rate_limit.route_whitelist;
                for (let i = 0; i < whiteRoutes.length; i++) {
                    if (pathName.startsWith(whiteRoutes[i])) {
                        next();
                        return;
                    }
                }

                let ip = req.ip.substring(req.ip.lastIndexOf(':') + 1, req.ip.length);
                if (securityConfig.rate_limit.ip_whitelist.indexOf(ip) !== -1) {
                    next();
                }
                else{
                    res.status(429).send({
                        status_code: 429,
                        error_code: 1,
                        timestamp: new Date().toISOString(),
                        error_description: "Too many requests, please try again later",
                        extra_data: "Too many requests, please try again later",
                        response_object: []
                    });
                }
            }
        });

        let protectedRoutes = securityConfig.rate_limit.protected_routes;
        protectedRoutes.forEach(function (path) {
            app.use(path, limiter);
        });
    }

    //Add cors support
    const corsDisabled = securityConfig.cors.length === 0 ? true : false;
    app.use(cors({
        credentials: true,
        origin: function (origin, callback) {
            // allow requests with no origin
            // (like mobile apps or curl requests)
            if (!origin || corsDisabled) return callback(null, true);

            for (var i = 0; i < securityConfig.cors.length; i++) {
                if (origin.startsWith(securityConfig.cors[i])) {
                    return callback(null, true);
                }
            }

            var msg = 'The CORS policy for this site does not ' +
                'allow access from the specified Origin.';
            return callback(new Error(msg), false);
        },
        exposedHeaders: ['Content-Range', 'X-Total-Count']
    }));
    // Request body parsing middleware should be above methodOverride
    app.use('/file-upload', bodyParser.raw({
        limit: '25mb'
    }));
    app.use('/', bodyParser.urlencoded({
        extended: true
    }));
    app.use('/', bodyParser.json({
        limit: securityConfig.max_body_size
    }));

    //Pevent sql injection
    app.use('/api', preventSqlInjection);
    app.use('/apiv2', preventSqlInjection);

    // Add the cookie parser and flash middleware
    app.use(cookieParser());

    //Custom error handling when error occurs in middleware
    app.use(function (err, req, res, next) {
        winston.error("A global uncatched error has been encountered", err);

        if (err.name === 'PayloadTooLargeError') {
            res.status(413).send({ message: 'Payload too large' });
        } else {
            res.status(500).send({ message: 'Internal server error' })
        }
    })
};

function preventSqlInjection(req, res, next) {
    let order = req.query._orderBy || req.query.order_by;
    if (order) {
        if(!dbColNameRegex.test(order)) {
            let response = {
                status_code: 400,
                error_code: -1,
                timestamp: 1,
                error_description: 'BAD_REQUEST',
                extra_data: 'Invalid col name for order',
                response_object: [],
                message: 'Invalid col name for order'
            };

            res.status(400).send(response);
            return;
        }

        //Validate dir
        if (req.query.order_dir) {
            let dir = req.query.order_dir.toUpperCase();
            if (validOrderDir.indexOf(dir) == -1) {
                dir = 'ASC'
            }

            req.query.order_dir = dir;
        }
        else if (req.query._orderDir) {
            let dir = req.query._orderDir.toUpperCase();
            if (validOrderDir.indexOf(dir) == -1) {
                dir = 'ASC'
            }

            req.query._orderDir = dir;
        }
    }

    next();
}

/**
 * Configure view engine
 */
module.exports.initViewEngine = function (app) {
    winston.info('Initializing ViewEngine...');
    // Set handlebars as the template engine
    app.engine('server.view.html', consolidate[config.templateEngine]);

    // Set views path and view engine
    app.set('view engine', 'server.view.html');
    app.set('views', './');
};

/**
 * Configure Express session
 */
module.exports.initSession = function (app, db) {
    winston.info('Initializing Session...');

    app.use(session({
        saveUninitialized: true,
        resave: true,
        secret: config.sessionSecret,
        cookie: {
            maxAge: config.sessionCookie.maxAge,
            httpOnly: config.sessionCookie.httpOnly,
            secure: config.sessionCookie.secure && config.secure && config.secure.ssl
        },
        key: config.sessionKey,
        /* store: new RedisStore({
            host: config.redis.host || 'localhost',
            port: config.redis.port || 6379,
            db: config.redis.database || 0,
            pass: config.redis.password || ''
        }) */
    }));

};

/**
 * Invoke modules server configuration
 */
module.exports.initModulesConfiguration = function (app, db) {
    winston.info('Initializing Modules Configuration...');
    config.files.server.configs.forEach(function (configPath) {
        require(path.resolve(configPath))(app, db);
    });
};

/**
 * Configure Helmet headers configuration
 */
module.exports.initHelmetHeaders = function (app) {
    winston.info('Initializing Helmet Headers...');
    // Use helmet to secure Express headers
    var SIX_MONTHS = 15778476000;
    app.use(helmet.frameguard());
    app.use(helmet.xssFilter());
    app.use(helmet.noSniff());
    app.use(helmet.ieNoOpen());
    app.use(helmet.hsts({
        maxAge: SIX_MONTHS,
        includeSubDomains: true,
        force: true
    }));
    app.disable('x-powered-by');
};

/**
 * Configure the modules static routes
 */
module.exports.initModulesClientRoutes = function (app) {
    winston.info('Initializing Modules Client Routes...');
    // Setting the app router and static folder
    app.use('/', express.static(path.resolve('./public')));
};

/**
 * Configure the modules ACL policies
 */
module.exports.initModulesServerPolicies = function (app) {
    winston.info('Initializing Modules Server Policies...');

    // Globbing policy files
    config.files.server.policies.forEach(function (policyPath) {
        require(path.resolve(policyPath)).invokeRolesPolicies();
    });
};

/**
 * Configure the modules server routes
 */
module.exports.initModulesServerRoutes = function (app) {
    winston.info('Initializing Modules Server Routes...');
    // Globbing routing files
    config.files.server.routes.forEach(function (routePath) {
        require(path.resolve(routePath))(app);
    });
};

/**
 * Configure error handling
 */
module.exports.initErrorRoutes = function (app) {
    winston.info('Initializing Error Routes...');
    app.use('/apiv4/*',function (err, req, res, next) {
        responseV4.sendError(req, res, 500, 51)
    });

    app.use(function (err, req, res, next) {
        res.status(500).send({
            status_code: 500,
            error_code: 1,
            timestamp: new Date().toISOString(),
            error_description: "Global Error",
            extra_data: "Something went wrong",
            response_object: []
        });
    });

    process.on('uncaughtException', function (err) {
        winston.error("Global error: ", err);
    });

    process.on('unhandledRejection', function (err) {
        winston.error("Global Rejection error: ", err);
    });
};

/**
 * Configure Socket.io
*/
//
module.exports.configureSocketIO = function (app, db) {
    winston.info('Initializing Socket.io...');
    // Load the Socket.io configuration
    var server = require('./socket.io')(app, db);

    // Return server object
    return server;
};

/**
 * Configure server response languages
 */
module.exports.configureLanguages = function (app) {
    winston.info('Initializing Languages ...');
    // Globbing routing files
    try {
        fs.readdir(language_folder_path, function (err, files) {
            files.forEach(function (file) {
                const lang = require(path.resolve(language_folder_path + file));
                if (lang.language_code && lang.language_name && lang.language_variables)
                    global.languages['' + lang.language_code + ''] = lang;
            });
        });

        fs.readdir(language_folder_pathV4, function (err, files) {
            files.forEach(function (file) {
                const lang = require(path.resolve(language_folder_pathV4 + file));
                if (lang.language_code && lang.language_name && lang.language_variables)
                    global.languagesV4[lang.language_code.toString()] = lang;
            });
        });

    } catch (error) {
        winston.error("Error loading languages!, error: ", error);
    }
};

/**
 * Initiatialize company configurations
 */
module.exports.readCompanyConfigurations = function (app) {
    winston.info('Initializing company configurations ...');
    // Globbing routing files
    try {
        const company_configurations = require(path.resolve('./config/company_configurations/' + fs.readdirSync('./config/company_configurations')[0]));
    }
    catch (error) {
        winston.error("Error reading company configurations, error: ", error);
    }
};

/**
 * Initialize the Express application
 */
module.exports.init = function (db, redis) {
    // Initialize distributed scheduler
    scheduler.init();
    
    // Initialize express app
    var app = express();

    // Initialize local variables
    this.initLocalVariables(app);

    // Initialize Express middleware
    this.initMiddleware(app);

    // Initialize Express view engine
    this.initViewEngine(app);

    // Initialize Express session
    //this.initSession(app, db);

    // Initialize Modules configuration
    this.initModulesConfiguration(app);

    // Initialize Helmet security headers
    this.initHelmetHeaders(app);

    // Initialize modules static client routes
    this.initModulesClientRoutes(app);

    // Initialize modules server authorization policies
    this.initModulesServerPolicies(app);

    // Initialize modules server routes
    this.initModulesServerRoutes(app);

    // Configure Languages
    this.configureLanguages(app);

    // Configure Languages
    this.readCompanyConfigurations(app);

    // Initialize error routes
    this.initErrorRoutes(app);

    // Configure Socket.io
    var serverApp = this.configureSocketIO(app, db);

    return serverApp;
};
