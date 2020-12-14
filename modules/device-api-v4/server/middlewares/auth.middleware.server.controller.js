const path = require("path"),
  db = require(path.resolve("./config/lib/sequelize")),
  models = db.models,
  authenticationHandler = require(path.resolve(
    "./modules/deviceapiv2/server/controllers/authentication.server.controller.js"
  )),
  redisClient = require(path.resolve("./config/lib/redis")).client,
  response = require(path.resolve("./config/responses.js")),
  winston = require("winston"),
  redis = require("redis");
const getClientIP = require(path.resolve("./custom_functions/getClientIP"));

const Joi = require("joi");
const moment = require("moment");

const responseHandler = require("../utils/response");
const tokenConfig = require(path.resolve("./config/jwt.config.json"));

const jwt = require("jsonwebtoken"),
  jwtIssuer = process.env.JWT_ISSUER,
  jwtSecret = process.env.JWT_SECRET_V4 || tokenConfig.jwtSecret;

const mobileAppIDs = [2, 3];
const appIDs = [1, 2, 3, 4, 5, 6, 7, 8, 9];

function missing_params(auth_obj) {
  return (
    auth_obj.sub === undefined ||
    auth_obj.data.app_id === undefined ||
    auth_obj.data.device_id === undefined
  );
}

function set_screensize(auth_obj) {
  if (mobileAppIDs.indexOf(auth_obj.app_id) !== -1) {
    auth_obj.screensize = 2;
  } else {
    auth_obj.screensize = 1;
  }
}

function valid_appid(auth_obj) {
  return appIDs.indexOf(parseInt(auth_obj.app_id)) !== -1;
}

function verifyAuth(req, res, auth) {
  return new Promise((resolve, reject) => {
    if (
      req.body.hdmi === true &&
      mobileAppIDs.indexOf(auth.data.app_id) !== -1
    ) {
      return reject({ code: 36 });
    } else if (valid_appid(auth.data) === true) {
      set_screensize(auth.data);
      //reading client data
      models.login_data
        .findOne({
          where: { username: auth.sub, company_id: auth.company_id },
        })
        .then(function (result) {
          if (result) {
            if (result.account_lock) {
              return reject({ code: 4 });
            }
            req.user = result;
            // req.auth = auth.data;
            resolve();
          } else return reject({ code: 2 });
        })
        .catch(function (error) {
          reject({ code: 51, error });
          winston.error(
            "Searching for the user account failed with error: ",
            error
          );
        });
    } else {
      reject({ code: 51 });
    }
  });
}

const requireToken = async (req, res, next) => {
  let tokenString = req.get("x-access-token");
  let token;
  const ip = getClientIP(req);
  const userAgent = req.get("user-agent") || "";

  if (tokenString) {
    const tokenArray = tokenString.split(" ");
    if (tokenArray.length > 0) {
      if (tokenArray[0] !== "Bearer") {
        return responseHandler.sendError(req, res, 401, 24);
      }
      token = tokenArray[1];
    }
  }

  if (!token || token === "") {
    return responseHandler.sendError(req, res, 401, 24);
  }

  let companyId = req.headers.company_id || 1;

  if (req.body.isFromCompanyList) {
    companyId = req.body.company_id;
  }

  try {
    if (!req.app.locals.backendsettings[companyId]) {
      return responseHandler.sendError(req, res, 501, 51);
    }
    const tokenDecrypted = jwt.verify(token, jwtSecret);

    if (tokenDecrypted.ip !== ip || tokenDecrypted.user_agent !== userAgent) {
      return responseHandler.sendError(req, res, 401, 56);
    }

    req.auth = tokenDecrypted;

    const missingParams = missing_params(tokenDecrypted);

    if (!missingParams) {
      await verifyAuth(req, res, tokenDecrypted);
    } else {
      return responseHandler.sendError(req, res, 401, 36);
    }

    if (!req.body.language) {
      if (tokenDecrypted.data) {
        req.body.language = tokenDecrypted.data.language || "en";
      } else {
        req.body.language = "eng";
      }
    }
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return responseHandler.sendError(req, res, 401, 54);
    } else if (err.name === "JsonWebTokenError") {
      return responseHandler.sendError(req, res, 401, 56);
    }
    responseHandler.sendError(req, res, 401, 51);
  }
};

function addRefreshTokenToList(refreshToken, username, accessToken, exp) {
  const key = `refresh_token:${username}:${refreshToken}`;
  redisClient.HMSET(
    key,
    {
      username: username,
      accessToken: accessToken,
    },
    (err, result) => {
      if (err) {
        winston.error("There was a redis error at auth error", err);
      }
      if (!isNaN(exp) && exp > 0) {
        redisClient.expire(key, parseInt(exp));
      }
    }
  );
}

function removeRefreshTokenfromList(refreshToken, username) {
  const key = `refresh_token:${username}:${refreshToken}`;
  redisClient.del(key, redis.print);
}

const requireSignIn = async (req, res, next) => {
  const ip = getClientIP(req);
  const userAgent = req.get("user-agent") || "";

  const schema = Joi.object().keys({
    username: Joi.string().alphanum().min(1).max(100).required(),
    password: Joi.string().required(),
    company_id: Joi.number().integer().default(1),
    screen_size: Joi.string().min(3).max(150).required(),
    app_id: Joi.number().integer().required(),
    device_brand: Joi.string().required(),
    network_type: Joi.number().integer().default(1),
    app_name: Joi.string().min(1).max(255).required(),
    os: Joi.string().min(1).max(255).required(),
    api_version: Joi.string().min(1).max(10).default("50"),
    app_version: Joi.string().min(1).max(10).required(),
    language: Joi.string().min(1).max(5).default("eng"),
    device_timezone: Joi.number().integer().required(),
    hdmi: Joi.boolean().default(false),
    firmware_version: Joi.string().max(255).required(),
    device_id: Joi.string().max(255).required(),
    mac_address: Joi.string().alphanum().length(12).required(),
  });

  const { error, value } = schema.validate(req.body);
  const {
    username,
    password,
    company_id,
    screen_size,
    app_id,
    device_brand,
    network_type,
    app_name,
    os,
    api_version,
    app_version,
    language,
    device_timezone,
    hdmi,
    firmware_version,
    device_id,
    mac_address,
  } = value;


  try {
    if (error) {
      return responseHandler.sendError(req, res, 400, 60);
    }

    const user = await models.login_data.findOne({
      where: { username: username, company_id: company_id },
    });
    if (!user) return responseHandler.sendError(req, res, 401, 2);

    if (user.account_lock) {
      return responseHandler.sendError(req, res, 401, 4);
    }

    authenticationHandler.encryptPasswordAsync(password, user.salt, (pass) => {
      if (pass === user.password) {
        const data = {
          username,
          company_id,
          screen_size,
          app_id,
          api_version,
          app_name,
          device_timezone,
          device_brand,
          mac_address,
          hdmi,
          firmware_version,
          app_version,
          language,
          os,
          network_type,
          device_id,
        };

        req.auth = data;
        req.user = user;

        const refreshToken = jwt.sign(
          {
            id: user.id,
            company_id: user.company_id,
            data: data,
            iss: jwtIssuer,
            ip: ip,
            user_agent: userAgent,
            sub: user.username,
          },
          req.user.refresh_token_secret,
          { expiresIn: tokenConfig.refreshTokenLife + "s" }
        );

        const accessToken = jwt.sign(
          {
            id: user.id,
            company_id: user.company_id,
            data: data,
            iss: jwtIssuer,
            sub: user.username,
            ip: ip,
            user_agent: userAgent,
          },
          jwtSecret,
          {
            expiresIn: tokenConfig.accessTokenLife + "s",
          }
        );

        req.deviceToken = accessToken;
        req.refreshToken = refreshToken;

        addRefreshTokenToList(
          refreshToken,
          req.user.username,
          accessToken,
          tokenConfig.refreshTokenLife
        );
        return next();
      } else {
        return responseHandler.sendError(req, res, 401, 1)
      }
    });
  } catch (e) {
    winston.error("There has been a error in here", e);
    next(e)
  }
};

/**
 * @api {post} /apiv4/auth/token/refresh Refresh the token
 * @apiName RefreshToken
 * @apiGroup DeviceAPI
 * @apiVersion 4.0.0
 * @apiDescription Generate new access token and new refresh token from a existing refresh token.
 *
 * @apiParam {String} refresh_token Existing refresh token.
 *
 * @apiSuccess {String} new_access_token The new access token.
 * @apiSuccess {String} new_refresh_token  The new refresh token.
 * @apiSuccess {String} token_expires_in  When token expires.
 * @apiSuccess {String} refresh_token_expires_in  When refresh token expires.
 * @apiSuccess {String} token_type  Token type, eg. "Bearer".
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     data: {
 *       "new_access_token": ""eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjUxOTIsImNvbXBhbnlfaWQiOjEsImRhdGEiOnsidXNlcm5hbWUiOiJrbGVu",
 *       "new_refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjUxOTIsImNvbXBhbnlfaWQiOjEsImRhdGEiOnsidXNlcm5hbWUiOiJrbGVuZGl0ZXN0MTEiLCJjb21wYW55X2lkIjoxLCJzY3JlZW5fc2l6ZSI6IjE2MDB4OTAwIiwiYXBwX2lkIjoxLCJhcGlfdmVyc2lvbiI6IjI1IiwiYXBwX25hbWUiOiJNQUdPV0FSRSIsImRldmljZV90aW1lem9uZSI6MiwiZGV2aWNlX2JyYW5kIjoiU0FNU1VORy1TTS1",
 *       token_expires_in: "5m"
 *       refresh_token_expires_in: "20m"
 *       token_type: "Bearer
 *     }
 *
 *
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 401 Unathorized
 *     {
 *        "error": {
 *          "code": 57,
 *           "message": "Invalid refresh token"
 *       }
 *  }
 */
const tokenRefresh = async (req, res) => {
  const ip = getClientIP(req);
  const userAgent = req.get("user-agent") || "";

  const schema = Joi.object().required().keys({
    refresh_token: Joi.string().required(),
  });

  const { error, value } = schema.validate(req.body);

  const refreshToken = value.refresh_token;

  if (error) {
    return responseHandler.sendError(req, res, 400, 60);
  }

  const jwtDecoded = jwt.decode(refreshToken);
  if (jwtDecoded.ip !== ip || jwtDecoded.user_agent !== userAgent) {
    return responseHandler.sendError(req, res, 401, 57);
  }

  const user = await db.models.login_data.findOne({
    where: {
      username: jwtDecoded.data.username,
    },
  });

  const refreshTokenSecret = user.refresh_token_secret;

  const key = `refresh_token:${jwtDecoded.data.username}:${refreshToken}`;
  redisClient.exists(key, function (err, exists) {
    if (exists) {
      let refreshTokenPayload;
      jwt.verify(refreshToken, refreshTokenSecret, function (err, decoded) {
        if (err) {
          responseHandler.sendError(req, res, 401, 19);
        }
        refreshTokenPayload = decoded;
      });

      const payload = {
        id: refreshTokenPayload.id,
        company_id: refreshTokenPayload.company_id,
        data: refreshTokenPayload.data,
        ip: ip,
        user_agent: userAgent,
        iss: jwtIssuer,
        sub: refreshTokenPayload.sub,
      };

      const accessToken = jwt.sign(payload, jwtSecret, {
        expiresIn: tokenConfig.accessTokenLife + "s",
      });
      const newRefreshToken = jwt.sign(payload, refreshTokenSecret, {
        expiresIn: tokenConfig.refreshTokenLife + "s",
      });
      const response = {
        new_access_token: accessToken,
        new_refresh_token: newRefreshToken,
        token_expires_in: tokenConfig.accessTokenLife + "s",
        refresh_token_expires_in: tokenConfig.refreshTokenLife + "s",
        token_type: "Bearer",
      };
      removeRefreshTokenfromList(refreshToken, user.username);
      addRefreshTokenToList(
        newRefreshToken,
        user.username,
        accessToken,
        tokenConfig.refreshTokenLife
      );
      responseHandler.sendData(req, res, response);
    } else {
      responseHandler.sendError(req, res, 401, 57);
    }
  });
};

/**
 * @api {post} /apiv4/auth/login-with-token Login With Token
 * @apiVersion 4.0.0
 * @apiName LoginWithToken
 * @apiGroup Login_V4
 *
 * @apiHeader {String} x-access-token Users JWT token.
 * @apiDescription Endpoint to login with your token
 * @apiSuccess (Success 200) {Object} response Response
 *
 * @apiErrorExample Error-Response:
 *  HTTP/1.1 500 Internal Server Error
 *   {
 *      "error": {
 *        "code": 51,
 *        "message": "Internal Error"
 *      }
 *   }
 */
exports.loginWithToken = async function (req, res, next) {
  let tokenString = req.get("x-access-token");
  let token;
  const ip = getClientIP(req);
  const userAgent = req.get("user-agent") || "";

  if (tokenString) {
    const tokenArray = tokenString.split(" ");
    if (tokenArray.length > 0) {
      if (tokenArray[0] !== "Bearer") {
        return responseHandler.sendError(req, res, 401, 24);
      }
      token = tokenArray[1];
    }
  }

  if (!token || token === "") {
    return responseHandler.sendError(req, res, 401, 24);
  }

  try {
    const tokenDecrypted = jwt.verify(token, jwtSecret);

    if (tokenDecrypted.ip !== ip || tokenDecrypted.user_agent !== userAgent) {
      return responseHandler.sendError(req, res, 401, 56);
    }

    req.auth = tokenDecrypted.data;

    const missingParams = missing_params(tokenDecrypted);

    if (!missingParams) {
      await verifyAuth(req, res, tokenDecrypted);
    } else {
      return responseHandler.sendError(req, res, 401, 36);
    }
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return responseHandler.sendError(req, res, 401, 54);
    } else if (err.name === "JsonWebTokenError") {
      return responseHandler.sendError(req, res, 401, 56);
    } else if (!!err.code) {
      return responseHandler.sendError(req, res, 401, err.code);
    }
    responseHandler.sendError(req, res, 401, 51);
  }
};

exports.plainAuth = async function (req, res, next) {
  const schema = Joi.object().keys({
    username: Joi.string().required(),
    password: Joi.string().required(),
    app_id: Joi.number().required(),
    device_id: Joi.string().required(),
    company_id: Joi.number().required(),
    mac_address: Joi.string().required(),
  });

  const header = req.get("x-plain-access-token");

  if (!header) {
    return responseHandler.sendError(req, res, 401, 24);
  }

  const data = decodeURIComponent(header);

  const { error, value } = schema.validate(JSON.parse(data));

  if (error || !header) {
    return responseHandler.sendError(req, res, 400, 60);
  }

  try {
    const {
      username,
      password,
      app_id,
      device_id,
      company_id,
      mac_address,
    } = value;

    const user = await models.login_data.findOne({
      where: { username: username, company_id: company_id },
    });

    if (!user) return responseHandler.sendError(req, res, 401, 2);

    if (user.account_lock) {
      return responseHandler.sendError(req, res, 401, 4);
    }

    authenticationHandler.encryptPasswordAsync(password, user.salt, (pass) => {
      if (pass !== user.password)
        return responseHandler.sendError(req, res, 401, 1);

      req.auth = {
        username,
        company_id: company_id,
        app_id,
        device_id,
        mac_address,
      };

      req.user = user;
      next();
    });
  } catch (e) {
    winston.error("There has been a error in here", e);
    responseHandler.sendError(req, res, 500, 51);
  }
};

exports.requireToken = requireToken;
exports.requireSignIn = requireSignIn;
exports.refreshToken = tokenRefresh;
