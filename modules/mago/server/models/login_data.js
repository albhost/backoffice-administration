"use strict";
const path = require('path');
const authenticationHandler = require(path.resolve('./modules/deviceapiv2/server/controllers/authentication.server.controller'));
const login_data_ctrl = require(path.resolve('./modules/deviceapiv2/server/controllers/credentials.server.controller'));
const {v4: uuid} = require("uuid")

module.exports = function (sequelize, DataTypes) {
  const loginData = sequelize.define('login_data', {
    id: {
      type: DataTypes.INTEGER(11),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
      unique: true
    },
    company_id: {
      type: DataTypes.INTEGER(11),
      allowNull: false,
      unique: 'username',
      defaultValue: 1
    },
    username: {
      type: DataTypes.STRING(32),
      allowNull: false,
      unique: 'username',
      validate: {isLowercase: true}
    },
    mac_address: {
      type: DataTypes.STRING(12),
      defaultValue: ''
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    salt: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    customer_id: {
      type: DataTypes.INTEGER(11),
      allowNull: false
    },
    channel_stream_source_id: {
      type: DataTypes.INTEGER(11),
      allowNull: false
    },
    vod_stream_source: {
      type: DataTypes.INTEGER(11),
      allowNull: false
    },
    pin: {
      type: DataTypes.STRING(6),
      allowNull: false
    },
    show_adult: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: true
    },
    auto_timezone: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    timezone: {
      type: DataTypes.INTEGER(3),
      allowNull: false,
      defaultValue: 0
    },
    player: {
      type: DataTypes.STRING(45),
      allowNull: false,
      defaultValue: (company_configurations.default_player) ? company_configurations.default_player : 'default'
    },
    activity_timeout: {
      type: DataTypes.INTEGER(11),
      allowNull: false,
      defaultValue: 10800
    },
    get_messages: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: (company_configurations.get_ads) ? company_configurations.get_ads : true
    },
    get_ads: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: (company_configurations.get_messages) ? company_configurations.get_messages : true
    },
    resetPasswordToken: {
      type: DataTypes.STRING(128),
      defaultValue: ' ',
      allowNull: true
    },
    resetPasswordExpires: {
      type: DataTypes.STRING(45),
      defaultValue: '0',
      allowNull: true
    },
    refresh_token_secret: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: true
    },
    vodlastchange: {
      type: DataTypes.BIGINT(13),
      defaultValue: Date.now(),
      allowNull: true
    },
    livetvlastchange: {
      type: DataTypes.BIGINT(13),
      defaultValue: Date.now(),
      allowNull: true
    },
    comment: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    account_lock: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    verified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    beta_user: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    max_login_limit: {
      type: DataTypes.INTEGER(11),
      allowNull: false,
      defaultValue: 1
    }
  }, {
    tableName: 'login_data',
    associate: function (models) {
      if (models.customer_data) {
        loginData.belongsTo(models.customer_data, {foreignKey: 'customer_id'});
      }
      if (models.channel_stream_source) {
        loginData.belongsTo(models.channel_stream_source, {foreignKey: 'channel_stream_source_id'});
      }
      /*      if (models.vod_stream){
                loginData.belongsTo(models.vod_stream, {foreignKey: 'vod_stream_source'});
            }*/
      if (models.subscription) {
        loginData.hasMany(models.subscription, {foreignKey: 'login_id'});
      }
      if (models.salesreport) {
        loginData.hasMany(models.salesreport, {foreignKey: 'login_data_id'});
      }
      if (models.commands) loginData.hasMany(models.commands);
      loginData.belongsTo(models.settings, {foreignKey: 'company_id'});
    }
  });

  loginData.beforeUpdate(function (login_data, options) {
    if (login_data.changed('password')) {
      var salt = authenticationHandler.makesalt();
      login_data.set('salt', salt);
      login_data.set('password', authenticationHandler.encryptPassword(login_data.password, salt));
    }
    if (login_data.changed('account_lock') && login_data.account_lock === true) {
      login_data_ctrl.lock_account(login_data.id, login_data.username);
    }
  });

  loginData.beforeCreate(function (login_data, options) {
    login_data.set('salt', login_data.salt);
    login_data.set('refresh_token_secret', uuid())
    login_data.set('password', authenticationHandler.encryptPassword(login_data.password, login_data.salt));
  });

  return loginData;
};
