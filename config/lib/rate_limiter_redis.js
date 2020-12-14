const { RateLimiterRedis } = require('rate-limiter-flexible');
const redisClient = require("./redis").client;
const rateLimiterSettings = require("../security/exprees.security.config");

const rateLimiterMiddlewareForgotPassword = (req, res, next) => {

  const rlForgotPassword = new RateLimiterRedis({
    redis: redisClient,
    keyPrefix: 'forgot_password_middleware_rl',
    points: rateLimiterSettings.rate_limit.forgot_password_max_req,
    duration: rateLimiterSettings.rate_limit.forgot_password_duration * 60, // per x seconds by ip,
    blockDuration: 60 * rateLimiterSettings.rate_limit.forgot_password_duration
  });

  rlForgotPassword.consume(req.ip)
    .then(() => {
      next();
    })
    .catch((error) => {
      const secs = Math.round(error.msBeforeNext / 1000) || 1;
      res.set('Retry-After', String(secs));
      res.status(429).send({
        status_code: 429,
        error_code: 1,
        timestamp: 1,
        error_description: "Too many requests, please try again later",
        extra_data: "Too many requests, please try again later",
        response_object: []
      });
    });
};


const guestRateLimiterMiddleware = (req, res, next) => {

  const rlFeed = new RateLimiterRedis({
    redis: redisClient,
    keyPrefix: 'rate_limiter_feed',
    points: rateLimiterSettings.rate_limit.guest_max_req,
    duration: rateLimiterSettings.rate_limit.guest_duration,
    blockDuration: rateLimiterSettings.rate_limit.guest_duration
  });

  rlFeed.consume(req.ip)
    .then(() => {
      next();
    })
    .catch((error) => {
      const secs = Math.round(error.msBeforeNext / 1000) || 1;
      res.set('Retry-After', String(secs));
      res.status(429).send({
        status_code: 429,
        error_code: 1,
        timestamp: 1,
        error_description: "Too many requests, please try again later",
        extra_data: "Too many requests, please try again later",
        response_object: []
      });
    });
};

exports.rateLimiterForgotPassword = rateLimiterMiddlewareForgotPassword;
exports.guestRateLimiterMiddleware = guestRateLimiterMiddleware;
