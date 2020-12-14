'use strict'

const path = require("path")
const winston = require('winston');
const redis = require("redis");
const moment = require("moment");
const redisClient = require(path.resolve('./config/lib/redis')).client;

const getStreamServersLoad = async () => {
  const streamServersKey = `stream_servers_data`

  return new Promise(async (resolve, reject) => {
      redisClient.get(streamServersKey, (err, streamServers) => {
        if (err) {
          reject(err)
          winston.error("Error at getting redis client", err)
        }
        resolve(streamServers)
      })
    }
  )
}

const getStreamServerLoad = async (serverAddress) => {
  const streamServersKey = `stream_servers_data`
  return new Promise(async (resolve, reject) => {
      redisClient.get(streamServersKey, (err, streamServersJson) => {
        if (err) {
          winston.error("Error at getting redis client", err)
          resolve();
          return;
        }

        if(!streamServersJson) return resolve({status: false, server_address: serverAddress, connection_status: "Error, Not found"})

        const streamServers = JSON.parse(streamServersJson);

        if(!streamServers) return resolve({status: false, server_address: serverAddress, connection_status: "Error, Not found"})

        const server = streamServers.find(x => x.server_address === serverAddress)
        if(!server) return resolve({status:false, server_address: serverAddress, connection_status: "Error, Not found"})
        resolve(server)
      })
    }
  )
}

const updateServers = async data => {
  const streamServersKey = `stream_servers_data`

  return new Promise(async (resolve, reject) => {
    redisClient.get(streamServersKey, (err, dtJson) => {
      const dataJson = JSON.parse(dtJson);

      let arr = [];

      for(let i = 0; i < dataJson.length; i++) {
        if(dataJson[i].server_address === data.server_address) {
          let server = {...dataJson[i], timestamp: moment().toISOString(),  ...data};
          arr.push(server)
        } else {
          arr.push(dataJson[i])
        }
      }

      const resultJson = JSON.stringify(arr);

      redisClient.set(streamServersKey, resultJson, (err, res) => {
        if(err) {
          return reject(err);
        }
        resolve();
      })

    })
  })
}

exports.getStreamServerLoad = getStreamServerLoad;
exports.getStreamServersLoad = getStreamServersLoad;
exports.updateServers = updateServers;

function randomIntFromInterval(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}