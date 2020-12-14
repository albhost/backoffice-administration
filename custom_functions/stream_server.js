"use strict";

const path = require("path");
const { models } = require("../config/lib/sequelize");
const axios = require("axios");
const winston = require("winston");
const redis = require("redis");
const redisClient = require("../config/lib/redis").client;
const crypto = require("crypto");
const moment = require("moment");

const checkStreamServers = async (rediss) => {
  try {
    const servers = await models.stream_server.findAll({
      where: {
        is_available: true,
      },
    });

    let arr = [];

    for (let i = 0; i < servers.length; i++) {
      let address = servers[i].server_address;
      if (servers[i].api_key) {
        const { hash, salt } = generateAuth(servers[i].api_key);
        address = `${address}?salt=${salt}&hash=${hash}`;
      }

      try {
        const { data, status, statusText } = await axios.get(address);
        const { Connections, OutRate } = data;

        const finalObject = {
          connections: Connections,
          out_rate: OutRate,
          connection_status: `${status} - ${statusText}`,
          timestamp: moment().toISOString(),
          ...servers[i].dataValues,
        };

        arr.push(finalObject);
      } catch (err) {
        let errorMessage;
        if (err.response) {
          errorMessage = `${err.response.status || 500} - ${
            err.response.statusText
          }`;
        } else {
          errorMessage = `500 - ${err.message}`;
        }
        errorMessage = errorMessage.substring(0, 200);
        arr.push({ ...servers[i].dataValues, connection_status: errorMessage });
      }
    }

    const dt = JSON.stringify(arr);

    const streamServersKey = `stream_servers_data`;

    rediss.set(streamServersKey, dt, (err) => {
      if (err) {
        throw new Error(err);
      }
    });
  } catch (err) {
    winston.error("Getting stream servers data failed with error ", err);
  }
};

const generateAuth = (key) => {
  const salt = randomIntFromInterval(0, 1000000);
  const string = `${salt}/${key}`;
  const hash = crypto.createHash("md5").update(string).digest("base64");

  return { salt, hash: hash };
};

function randomIntFromInterval(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

const start = (rediss) => {
  setInterval(() => {
    checkStreamServers(rediss);
  }, 120000);
}

module.exports = start;