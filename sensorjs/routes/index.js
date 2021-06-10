/*
 * This file is part of sensor-pi-js a simple platform to collect and visualize
 * sensor data using Raspberry Pi, wireless sensor nodes and Web technology.
 * 
 * Copyright (C) 2021 Enrico Costanza e.costanza@ucl.ac.uk
 *
 * This program is free software: you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option)
 * any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of  MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for
 * more details.
 *
 * You should have received a copy of the GNU General Public License along with
 * this program.  If not, see <http://www.gnu.org/licenses/>.
 */

/*eslint-env node*/
var express = require('express');
var router = express.Router();
// var diskfree = require('diskfree');
const checkDiskSpace = require('check-disk-space');
const os = require('os');
const { DateTime } = require('luxon');
const { exec } = require('child_process');

const wifi_config = require('./wifi_config');

// influx code based on
// https://www.influxdata.com/blog/getting-started-with-node-influx/
const Influx = require('influx');

const influx = new Influx.InfluxDB({
  host: 'localhost',
  database: 'sdstore'
});

/* GET home page. */
router.get('/', function(req, res) {
  checkDiskSpace('/').then((info) => {
    const free_ratio = info.free / info.size;
    const free = `${(100 * free_ratio).toFixed()}%`;
  
    res.render('index.html', { 
      title: 'Express',
      free: free
    });

  });

});


// router.get('/measurements/', function(req, res) {
//   influx.query('SHOW MEASUREMENTS')
//     .then( result => res.json(result) )
//     .catch( error => res.status(500).json(error) );
// });

router.get('/series/', function(req, res) {
  let recentOnly = false;
  if (req.query.recent !== undefined) {
    recentOnly = true;
  }

  const uptime = os.uptime();
  const offset = (new Date()).getTimezoneOffset() * 60 * 1000;
  const recentTs = Date.now() - offset - uptime * 1000;

  const query = `SELECT LAST(value) FROM /.*/ GROUP BY *`;
  influx.query(query)
      .then( function(result) {
          const rearranged = result.groupRows.map(function (item) {
              return {
                  'measurement': item.name,
                  'sensor_id': item.tags.sensor_id,
                  'latest': item.rows[0].time
              };
          });
          // console.log(rearranged);
          if (recentOnly === true) {
            const filtered = rearranged.filter(function (item) { return item.latest > recentTs; })
            res.json(filtered);  
          } else {
            res.json(rearranged);
          }
      })
      .catch( error => res.status(500).json(error) );

});

function runValuesAndRangeQuery (res, query, measurement) {
  const uptime = os.uptime();
  const rangeQuery = `
    SELECT MIN("value"), MAX("value")
    FROM "${measurement}"
    WHERE 
    time >= now() - ${uptime}s
  `;

  influx.query(rangeQuery)
    .then( rangeResult => {
      // console.log('rangeResult[0]', rangeResult[0]);
      let min = 0;
      let max = 100;
      if (rangeResult[0] !== undefined) {
        min = rangeResult[0].min;
        max = rangeResult[0].max;
      }
      influx.query(query)
      .then( result => res.json({
        readings: result,
        min: min,
        max: max
      }) )
      .catch( error => {
        console.log(error);
        res.status(500).json(error);
      });
  
    })
    .catch( rangeError => {
      console.log(rangeError);
      res.status(500).json(rangeError);
    });
  
}

function buildValuesQuery(start, end, points, measurement, sensor_id, recentOnly) {
  const offset = (new Date()).getTimezoneOffset() * 60 * 1000;
  const startTs = Date.now() - offset - start * 60 * 1000;
  const endTs = Date.now() - offset - end * 60 * 1000;

  let bySensor = '';
  if (typeof sensor_id !== 'undefined') {
    bySensor = `"sensor_id" = '${sensor_id}' AND `;
  }

  const deltaMinutes = start - end;
  const interval = Math.ceil(deltaMinutes / points);

  const select = 'SELECT "time", mean("value") as "value"';
  const  groupBy = `GROUP BY time(${interval}m)`;

  const uptime = os.uptime();
  let recent = `time >= now() - ${uptime}s AND`;
  if (recentOnly === false) {
    recent = '';
  }
  const query = `
    ${select}
    FROM "${measurement}"
    WHERE 
    ${bySensor}
    time >= ${startTs}ms AND 
    ${recent}
    time < ${endTs}ms 
    ${groupBy}
  `;

//  console.log(query);

  return query;
}

function parseRequestParameters(req) {
  let start = 60;
  let end = 0;
  let points = 30;
  let recentOnly = true;

  if (req.query.start !== undefined) {
    start = 0 - +req.query.start;
  }
  if (req.query.end !== undefined) {
    end = 0 - +req.query.end;
  }
  if (req.query.points !== undefined) {
    points = +req.query.points;
  }
  if (req.query.recent !== undefined) {
    recentOnly = false;
  }

  return {
    'start': start,
    'end': end,
    'points': points,
    'recentOnly': recentOnly
  };
}

const getDataByMeasurementAndSensor = function (req, res, measurement, sensor_id) {
  let {start, end, points, recentOnly} = parseRequestParameters(req);

  const query = buildValuesQuery(start, end, points, measurement, sensor_id, recentOnly);
  runValuesAndRangeQuery(res, query, measurement);
};

// TODO: combine this function with the one below
router.get('/series/:key/data/', function(req, res) {
  let key = req.params.key;
  let measurement = key.split(',')[0];
  let sensor_id = key.split('=')[1];

  getDataByMeasurementAndSensor(req, res, measurement, sensor_id);
});


router.get('/measurement/:measurement/sensor/:sensor_id/data/', function(req, res) {
  const measurement = req.params.measurement;
  const sensor_id = req.params.sensor_id;

  getDataByMeasurementAndSensor(req, res, measurement, sensor_id);
});

router.get('/wificonfig/', function (req, res) {
  console.log(req.params)
  res.render('wifi.html', { 
    title: 'Express'
  });
});


router.post('/wificonfig/', function (req, res) {
  console.log(req.body);
  const ssid = req.body.ssid;
  const networkPassword = req.body.networkPassword;
  console.log(ssid, networkPassword);

  wifi_config.updateNetworkInfo({
    newSsid: ssid,
    newPass: networkPassword,
    cb: function (err) {
      res.json({
        'err': err
      })
      }
  });
  
});


router.post('/settime/', function (req, res) {
  console.log(req.body);
  const datetimeString = req.body.datetime;
  console.log(datetimeString);

  // datetimeString
  const datetime = DateTime.fromISO(datetimeString);
  console.log(datetime);
  // MMDDhhmmYYYY
  const tstr = datetime.toFormat('HH:mm:ss dd LLL yyyy');
  exec('sudo date -s "'+tstr+'"', function (error, stdout, stderr) {
    if (error) {
      res.json({
        'err': error
      })
    } else {
      res.json({
        'stdout': stdout,
        'stderr': stderr
      })
    }
  });
});


module.exports = router;

