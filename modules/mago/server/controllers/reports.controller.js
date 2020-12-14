/**
 * Module dependencies.
 */
var path = require('path'),
    errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller')),
    db = require(path.resolve('./config/lib/sequelize')).models,
    winston = require('winston'),
    sequelize = require('sequelize'),
    dbRaporte = require(path.resolve('./config/lib/sequelize')),
    moment = require('moment'),
    escape = require(path.resolve('./custom_functions/escape'));
LoginData = db.login_data;
Combo = db.combo;
SalesReport = db.salesreport;
DBModel = db.salesreport;
const { Op } = require('sequelize');
/**
 * List of Subscribers
 * */
exports.listOfSubscribers = function(req, res) {
    LoginData.findAll({
        include: [
            {model:db.customer_data},
            {model:db.subscription,
                order: [['end_date','ASC']],
                limit: 1
            }
        ],
        where: {company_id: req.token.company_id}
    }).then(function(results) {
        if (!results) {
            return res.status(404).send({
                message: 'No data found'
            });
        } else {
            res.json(results);
        }
    }).catch(function(err) {
        winston.error("Getting list of client accounts failed with error: ", err);
        res.jsonp(err);
    });
};

/**
 * List of Sales
 * */
exports.listOfSales = function(req, res) {
    SalesReport.findAll({
        include: [db.combo,db.users],
        where: {company_id: req.token.company_id}
    }).then(function(results) {
        if (!results) {
            return res.status(404).send({
                message: 'No data found'
            });
        } else {
            res.json(results);
        }
    }).catch(function(err) {
        winston.error("Getting list of sales flailed with error: ", err);
        res.jsonp(err);
    });
};

/**
 * Expiring next week.
 * */
exports.expiringNextWeek = function(req, res) {
    LoginData.findAll({
        include:[
            {model: db.customer_data},
            {model:db.subscription, where:{end_date:{
                [Op.between]:[
                    new Date().getNextWeekMonday(),
                    new Date().getNextWeekSunday()
                ]
            }}}
        ],
        where: {company_id: req.token.company_id}
    }).then(function(results) {
        if (!results) {
            return res.status(404).send({
                message: 'No data found'
            });
        } else {
            res.json(results);
        }
    }).catch(function(err) {
        winston.error("Getting list of subscriptions expiring in 7days failed with error: ", err);
        res.jsonp(err);
    });
};

/**
 * Sales by product
 * */
exports.listSalesByProduct = function(req, res) {
    Combo.findAll({
        include: [db.salesreport],
        where: {company_id: req.token.company_id}
    }).then(function(results) {
        if (!results) {
            return res.status(404).send({
                message: 'No data found'
            });
        } else {
            res.json(results);
        }
    }).catch(function(err) {
        winston.error("Getting sales per combo failed with error: ", err);
        res.jsonp(err);
    });
};

/**
 * @api {get} /api/reports/previous_day_reports Sales - Previous Day Subscription
 * @apiVersion 0.2.0
 * @apiName Sales - Previous Day Subscription
 * @apiGroup Backoffice
 * @apiHeader {String} authorization Token string acquired from login api.
 *
 * @apiSuccess (200) {String} message Full list of number of subscriptions
 * @apiError (40x) {String} message Error message.
 */
exports.listPreviousDaySalesByProduct = function (req, res) {
    dbRaporte.sequelize.query("SELECT c.NAME AS 'product', Count( sr.id ) AS 'total' " +
            "FROM combo c " +
            "INNER JOIN salesreport sr ON sr.combo_id = c.id " +
            "WHERE saledate = subdate( CURRENT_DATE, 1 ) AND sr.active = 1 AND c.isavailable = 1 " +
            "GROUP BY c.name ",
        {type: dbRaporte.sequelize.QueryTypes.SELECT})
        .then(function (results) {
            if (!results) {
                return res.status(404).send({
                    message: 'No data found'
                });
            } else {
                res.json(results);
            }
        }).catch(function (err) {
        winston.error("Getting sales failed with error: ", err);
        res.jsonp(err);
    });
};

/**
 * @api {get} /api/reports/month_sales Sales - This Month Subscription
 * @apiVersion 0.2.0
 * @apiName Sales - This Month Subscription
 * @apiGroup Backoffice
 * @apiHeader {String} authorization Token string acquired from login api.
 *
 * @apiSuccess (200) {String} message Full list of number of subscriptions
 * @apiError (40x) {String} message Error message.
 */
exports.listMonthSalesByProduct = function (req, res) {
    dbRaporte.sequelize.query("SELECT c.NAME AS 'product', Count( sr.id ) AS 'total' " +
            "FROM combo c " +
            "INNER JOIN salesreport sr ON sr.combo_id = c.id " +
            "WHERE ( saledate BETWEEN DATE_FORMAT( NOW( ), '%Y-%m-01' ) AND NOW( ) ) AND sr.active = 1 AND c.isavailable = 1 " +
            "GROUP BY c.name",
        {type: dbRaporte.sequelize.QueryTypes.SELECT})
        .then(function (results) {
            if (!results) {
                return res.status(404).send({
                    message: 'No data found'
                });
            } else {
                res.json(results);
            }
        }).catch(function (err) {
        winston.error("Getting sales failed with error: ", err);
        res.jsonp(err);
    });
};

/**
 * @api {get} /api/reports/lastmonth_sales Sales - Previous Month Subscription
 * @apiVersion 0.2.0
 * @apiName Sales - Previous Month Subscription
 * @apiGroup Backoffice
 * @apiHeader {String} authorization Token string acquired from login api.
 *
 * @apiSuccess (200) {String} message Full list of number of subscriptions
 * @apiError (40x) {String} message Error message.
 */
exports.listLastMonthSalesByProduct = function (req, res) {
    const company_id = req.token.company_id || 1;
    dbRaporte.sequelize.query("SELECT c.NAME AS 'product', Count( sr.id ) AS 'total' " +
            "FROM combo c " +
            "INNER JOIN salesreport sr ON sr.combo_id = c.id " +
            "WHERE saledate BETWEEN last_day( curdate( ) - INTERVAL 2 MONTH ) + INTERVAL 1 DAY AND company_id = " +company_id +
            " AND last_day( curdate( ) - INTERVAL 1 MONTH ) " +
            "AND sr.active = 1 AND c.isavailable = 1 " +
            "GROUP BY c.name " +
            "ORDER BY c.name",
        {type: dbRaporte.sequelize.QueryTypes.SELECT})
        .then(function (results) {
            if (!results) {
                return res.status(404).send({
                    message: 'No data found'
                });
            } else {
                res.json(results);
            }
        }).catch(function (err) {
        winston.error("Getting sales failed with error: ", err);
        res.jsonp(err);
    });
}

/**
 * @api {get} /api/reports/eachmonth_sales Sales -  Monthly Subscription
 * @apiVersion 0.2.0
 * @apiName Sales - Monthly Month Subscription
 * @apiGroup Backoffice
 * @apiHeader {String} authorization Token string acquired from login api.
 *
 * @apiSuccess (200) {String} message Full list of number of subscriptions
 * @apiError (40x) {String} message Error message.
 */
exports.listEachMonthSalesByMonth = function (req, res) {
    dbRaporte.sequelize.query("SELECT CONCAT ( MIN( DATE( saledate ) ), ' -- ', MAX( DATE( saledate ) ) ) AS 'duration', " +
            " count( saledate ) AS 'total' " +
            "FROM combo c " +
            "INNER JOIN salesreport sr ON sr.combo_id = c.id " +
            "WHERE saledate BETWEEN MAKEDATE( YEAR ( now( ) ), 1 ) AND ( CURRENT_DATE ) " +
            "AND active = '1' AND c.isavailable = 1 " +
            "GROUP BY MONTH ( saledate ) ",
        {type: dbRaporte.sequelize.QueryTypes.SELECT})
        .then(function (results) {
            if (!results) {
                return res.status(404).send({
                    message: 'No data found'
                });
            } else {
                res.json(results);
            }
        }).catch(function (err) {
        winston.error("Getting sales failed with error: ", err);
        res.jsonp(err);
    });
};

/**
 * @api {get} /api/reports/last_year_sales Sales - Previous Year Subscription
 * @apiVersion 0.2.0
 * @apiName Sales - Previous Year Subscription
 * @apiGroup Backoffice
 * @apiHeader {String} authorization Token string acquired from login api.
 *
 * @apiSuccess (200) {String} message Full list of number of subscriptions
 * @apiError (40x) {String} message Error message.
 */
exports.listLastYearSales = function (req, res) {
    dbRaporte.sequelize.query("SELECT CONCAT ( MIN( DATE( saledate ) ), ' -- ', MAX( DATE( saledate ) ) ) AS 'duration'," +
            "count( saledate ) AS total " +
            "FROM combo c " +
            "INNER JOIN salesreport sr ON sr.combo_id = c.id " +
            "WHERE saledate BETWEEN MAKEDATE( YEAR ( now( ) ), 1 ) - INTERVAL 1 YEAR " +
            "AND STR_TO_DATE( CONCAT( 12, 31, YEAR ( CURDATE( ) ) - 1 ), '%m%d%Y' ) AND active = '1' " +
            "AND c.isavailable = 1 " +
            "GROUP BY MONTH ( saledate )",
        {type: dbRaporte.sequelize.QueryTypes.SELECT})
        .then(function (results) {
            if (!results) {
                return res.status(404).send({
                    message: 'No data found'
                });
            } else {
                res.json(results);
            }
        }).catch(function (err) {
        winston.error("Getting sales failed with error: ", err);
        res.jsonp(err);
    });
};

/**
 * @api {get} /api/reports/expiresubscription Sales - Expire Subscription
 * @apiVersion 0.2.0
 * @apiName Sales - Expire Subscription
 * @apiGroup Backoffice
 * @apiHeader {String} authorization Token string acquired from login api.
 *
 * @apiSuccess (200) {String} message Full list of number of expire subscriptions
 * @apiError (40x) {String} message Error message.
 */
exports.listExpireSubcription = function (req, res) {
    const company_id = req.token.company_id ? req.token.company_id : 1;
    dbRaporte.sequelize.query(" select DATE(end_date) AS to_date," +
      " COUNT(end_date) AS total from subscription " +
      "where end_date BETWEEN CURDATE() AND  CURDATE() + INTERVAL 31 DAY AND company_id = " + company_id +
      " GROUP BY DAY(end_date) ORDER BY to_date",
        {type: dbRaporte.sequelize.QueryTypes.SELECT})
        .then(function (results) {
            if (!results) {
                return res.status(404).send({
                    message: 'No data found'
                });
            } else {
                let target = new Date().setDate(
                  new Date().getDate() + 31
                );
                let report = [];
                for (let d = new Date(); d <= target; d.setDate(d.getDate() + 1)) {
                    const _item = results.find(item => moment(item.to_date).format("DD-MM-YY") === moment(d).format("DD-MM-YY"));
                    if (_item) {
                        report.push(_item)
                    } else {
                        report.push({
                            to_date: moment(d).toISOString(),
                            total: 0
                        })
                    }
                }

                res.json(results);
            }
        }).catch(function (err) {
        winston.error("Getting sales failed with error: ", err);
        res.jsonp(err);
    });
};


/**
 * @api {get} /api/reports/expiresubscriptionbyday Sales - Expire Subscription
 * @apiVersion 0.2.0
 * @apiName Sales - Expire Subscription
 * @apiGroup Backoffice
 * @apiHeader {String} authorization Token string acquired from login api.
 *
 * @apiSuccess (200) {String} message Full list of number of expire subscriptions
 * @apiError (40x) {String} message Error message.
 */
exports.listExpireSubcriptionByDay = function (req, res) {
    const company_id = req.token.company_id ? req.token.company_id : 1;
    dbRaporte.sequelize.query(`select count(*) as total, DATE_FORMAT(end_date, '%Y-%m-15') as to_date
        from subscription
        where end_date >= NOW() and company_id = ?
        group by MONTH(end_date), YEAR(end_date)
        order by end_date;`,
      {type: dbRaporte.sequelize.QueryTypes.SELECT, replacements: [company_id],})
      .then(function (results) {
          if (!results) {
              return res.status(404).send({
                  message: 'No data found'
              });
          } else {
              res.json(results);
          }
      }).catch(function (err) {
        winston.error("Getting sales failed with error: ", err);
        res.jsonp(err);
    });
};



exports.activeDevices = function (req, res) {
    let company_id = req.token.company_id ? req.token.company_id : 1;
    dbRaporte.sequelize.query(`SELECT *
        FROM (select id, DATE(createdAt) as date, COUNT(id) as total, appid
      from devices
      where createdAt >= DATE_SUB(now(), INTERVAL 12 MONTH)
        and company_id = ?
      GROUP BY YEAR(createdAt), MONTH(createdAt), appid) a;`,
        {type: dbRaporte.sequelize.QueryTypes.SELECT, replacements: [company_id]})
        .then(function (results) {
            if (!results) {
                return res.status(404).send({
                    message: 'No data found'
                });
            } else {
                res.json(results);
            }
        }).catch(function (err) {
        winston.error("Getting sales failed with error: ", err);
        res.jsonp(err);
    });
};

exports.allActiveDevices = function (req,res){
    let company_id = req.token.company_id ? req.token.company_id : 1;
    dbRaporte.sequelize.query(`SELECT *
        FROM (select id, DATE(createdAt) as date, COUNT(id) as total, appid
      from devices
      where createdAt >= DATE_SUB(now(), INTERVAL 12 MONTH)
        and company_id = ?
      GROUP BY (appid), appid) a;`,
        {type: dbRaporte.sequelize.QueryTypes.SELECT, replacements: [company_id]})
        .then(function (results) {
            if (!results) {
                return res.status(404).send({
                    message: 'No data found'
                });
            } else {
                res.json(results);
            }
        }).catch(function (err) {
        winston.error("Getting sales failed with error: ", err);
        res.jsonp(err);
    });
}




exports.listLastTwoYearsSales = function (req, res) {
    let company_id = req.token.company_id ? req.token.company_id : 1;
    dbRaporte.sequelize.query(" select DATE_FORMAT(saledate, '%Y-%m-15') as date," +
        " COUNT(saledate) AS total from salesreport" +
        " where saledate >= NOW() - INTERVAL 24 MONTH and company_id = " + company_id +
        " group by month(saledate), year(saledate)" +
        " ORDER BY saledate ",
        {type: dbRaporte.sequelize.QueryTypes.SELECT})
        .then(function (results) {
            if (!results) {
                return res.status(404).send({
                    message: 'No data found'
                });
            } else {
                res.json(results);
            }
        }).catch(function (err) {
        winston.error("Getting sales failed with error: ", err);
        res.jsonp(err);
    });
}

/**
 * @api {get} /api/reports/each_day_sales Sales - Total Subscription
 * @apiVersion 0.2.0
 * @apiName Sales - Total Subscription
 * @apiGroup Backoffice
 * @apiHeader {String} authorization Token string acquired from login api.
 * @apiParam {String} startsaledate  Optional field startsaledate.
 * @apiParam {String} endsaledate  Optional field endsaledate.
 *
 * @apiSuccess (200) {String} message Full list of number of subscriptions
 * @apiError (40x) {String} message Error message.
 */
exports.listEachDaySales = function (req, res) {
    var qwhere = {},
        final_where = {},
        query = req.query;
    final_where.where = qwhere;

    if (req.query.active === 'active') final_where.where.active = true;
    if (req.query.active === 'cancelled') final_where.where.active = false;

    if (req.query.startsaledate) final_where.where.saledate = {[Op.gte]: req.query.startsaledate};
    if (req.query.endsaledate) final_where.where.saledate = {[Op.lte]: req.query.endsaledate};

    if ((req.query.startsaledate) && (req.query.endsaledate)) final_where.where.saledate = {
        [Op.gte]: req.query.startsaledate,
        [Op.lte]: req.query.endsaledate
    };

    if (parseInt(query._start)) final_where.offset = parseInt(query._start);
    if (parseInt(query._end)) final_where.limit = parseInt(query._end) - parseInt(query._start);
    if (query._orderBy) final_where.order = [[escape.col(query._orderBy), escape.orderDir(query._orderDir)]];

    final_where.attributes = ['id', 'combo_id', [sequelize.fn('max', sequelize.col('saledate')), 'saledate'], 'createdAt', [sequelize.fn('count', sequelize.col('combo_id')), 'count']];
    final_where.include = [{model: db.combo, required: true, attributes: ['name']}];
    final_where.group = ['name'];

    DBModel.findAndCountAll(
        final_where
    ).then(function (results) {
        if (!results) {
            return res.status(404).send({
                message: 'No data found'
            });
        } else {
            res.json(results);
        }
    }).catch(function (err) {
        winston.error("Getting sales failed with error: ", err);
        res.jsonp(err);
    });
};


/**
 * Date Proto Functions, TODO: Move Later on
 * */

Date.prototype.getNextWeekMonday = function() {
    var d = new Date(this.getTime());
    var diff = d.getDate() - d.getDay() + 1;
    if (d.getDay() == 0)
        diff -= 7;
    diff += 7; // ugly hack to get next monday instead of current one
    return new Date(d.setDate(diff));
};

Date.prototype.getNextWeekSunday = function() {
    var d = this.getNextWeekMonday();
    return new Date(d.setDate(d.getDate() + 6));
};

