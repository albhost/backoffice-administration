'use strict';
var winston = require('winston');

module.exports = {
  up:  (queryInterface, DataTypes)  => {
return queryInterface.createTable(
    'tv_series_resume', {
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
            defaultValue: 1
        },
        login_id: {
            type: DataTypes.INTEGER(11),
            allowNull: false
        },
        tv_series_id: {
            type: DataTypes.INTEGER(11),
            allowNull: false
        },
        device_id: {
            type: DataTypes.STRING,
            allowNull: false
        },
        reaction: { //value set should be [-1, 0, 1]
            type: DataTypes.INTEGER(11),
            allowNull: false,
            defaultValue: 0
        },
        favorite: { //value set should be [0, 1]
            type: DataTypes.INTEGER(11),
            allowNull: true,
            defaultValue: 0
        },
        createdAt: {type: DataTypes.DATE},
        updatedAt: {type: DataTypes.DATE}
    }).catch((err)=>{winston.error('Creating table tv_series_resume failed with error message: ',err.message);});
  },

  down: (queryInterface, Sequelize) => {
return queryInterface.dropTable('tv_series_resume')
    .catch(err=>{
        winston.error('Deleting table tv_series_resume failed with error message: ', err.message)
    })
  }
};
