"use strict";

module.exports = function(sequelize, DataTypes) {
    var tv_series_resume = sequelize.define('tv_series_resume', {
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
        createdAt: {
            type: DataTypes.DATE
        },
        updatedAt: {
            type: DataTypes.DATE
        }
    }, {
        tableName: 'tv_series_resume',
        associate: function(models) {
            if (models.login_data){
                tv_series_resume.belongsTo(models.login_data, {foreignKey: 'login_id'});
            }
            if (models.tv_series){
                tv_series_resume.belongsTo(models.tv_series, {foreignKey: 'tv_series_id'});
            }
            tv_series_resume.belongsTo(models.settings, {foreignKey: 'company_id'});

        }
    });
    return tv_series_resume;
};