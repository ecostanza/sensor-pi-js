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
    const free = `${(100 - 100 * free_ratio).toFixed()}%`;
  
    res.render('index.html', { 
      title: 'Express',
      free: free
    });

  });

});

/* GET home page. */
router.get('/check', function(req, res) {
  checkDiskSpace('/').then((info) => {
    const free_ratio = info.free / info.size;
    const free = `${(100 - 100 * free_ratio).toFixed()}%`;
  
    res.render('check.html', { 
      title: 'Check',
      free: free
    });

  });

});


router.get('/annotate', function(req, res) {
  checkDiskSpace('/').then((info) => {
    const free_ratio = info.free / info.size;
    const free = `${(100 - 100 * free_ratio).toFixed()}%`;
  
    res.render('annotate.html', { 
      title: 'Annotate',
      free: free
    });

  });
});

router.get('/temperature', function(req, res) {
  checkDiskSpace('/').then((info) => {
    const free_ratio = info.free / info.size;
    const free = `${(100 - 100 * free_ratio).toFixed()}%`;
  
    res.render('temperature_mixed.html', { 
      title: 'Annotate Measures',
      free: free
    });

  });
});

router.get('/config', function(req, res) {
  checkDiskSpace('/').then((info) => {
    const free_ratio = info.free / info.size;
    const free = `${(100 - 100 * free_ratio).toFixed()}%`;
  
    res.render('config.html', { 
      title: 'Configure Measures',
      free: free
    });

  });
});

router.get('/favicon.ico', function(req, res) {
  res.redirect('/static/favicon.ico');
})

// router.get('/measurements/', function(req, res) {
//   influx.query('SHOW MEASUREMENTS')
//     .then( result => res.json(result) )
//     .catch( error => res.status(500).json(error) );
// });

router.get('/series/', function(req, res) {
  const recentOnly = !(req.query.showAll === 'true');
  const recentDays = req.query.days;

  let uptime = os.uptime();
  if (recentDays !== undefined) {
    uptime = recentDays * 24 * 60 * 60;
  }
  const offset = (new Date()).getTimezoneOffset() * 60 * 1000;
  const recentTs = Date.now() - offset - uptime * 1000;

  const query = `SELECT LAST(value) FROM /.*/ GROUP BY *`;
  influx.query(query)
      .then( function(result) {
          // console.log(result);
          const rearranged = result.groupRows.map(function (item) {
              return {
                  'measurement': item.name,
                  'value': item.rows[0].last,
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

function runValuesAndRangeQuery (res, valuesQuery, rangeQuery) {
  influx.query(rangeQuery)
    .then( rangeResult => {
      // console.log('rangeResult[0]', rangeResult[0]);
      let min = 0;
      let max = 100;
      if (rangeResult[0] !== undefined) {
        min = rangeResult[0].min;
        max = rangeResult[0].max;
      }
      influx.query(valuesQuery)
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

function buildQueries(start, end, points, measurement, sensor_id, recentOnly) {
  const offset = 0;//(new Date()).getTimezoneOffset() * 60 * 1000;
  const startTs = Date.now() - offset - start * 60 * 1000;
  const endTs = Date.now() - offset - end * 60 * 1000;

  let bySensor = '';
  if (typeof sensor_id !== 'undefined') {
    bySensor = `"sensor_id" = '${sensor_id}' AND `;
  }

  const deltaMinutes = start - end;
  const interval = 1// 60 // Math.ceil(deltaMinutes / points); 30min CHECK

  const select = 'SELECT "time", mean("value") as "value"';
  const groupBy = `GROUP BY time(${interval}m)`;

  const uptime = os.uptime();
  let recent = `time >= now() - ${uptime}s AND`;
  if (recentOnly === false) {
    recent = '';
  }
  const valuesQuery = `
    ${select}
    FROM "${measurement}"
    WHERE 
    ${bySensor}
    time >= ${startTs}ms AND 
    ${recent}
    time < ${endTs}ms 
    ${groupBy}
  `;

  const rangeQuery = `
    SELECT MIN("value"), MAX("value")
    FROM "${measurement}"
    WHERE 
    ${bySensor}
    time >= ${startTs}ms AND 
    ${recent}
    time < ${endTs}ms 
  `;

//  console.log(query);

  return {
    'valuesQuery': valuesQuery,
    'rangeQuery': rangeQuery
  };
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
  if (req.query.showAll !== undefined) {
    recentOnly = !(req.query.showAll === 'true');
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

  const q = buildQueries(start, end, points, measurement, sensor_id, recentOnly);
  runValuesAndRangeQuery(res, q.valuesQuery, q.rangeQuery);
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

router.get('/measurement/:measurement/sensor/:sensor_id/rawdata/', function(req, res) {
  const measurement = req.params.measurement;
  const sensor_id = req.params.sensor_id;

  const select = 'SELECT "time", "value"';
  let bySensor = '';
  if (typeof sensor_id !== 'undefined') {
    bySensor = `"sensor_id" = '${sensor_id}'`;
  }

  let start = req.query.start;
  if (start === undefined) {
    start = '2022-04-01';
  }
  let end = req.query.end;
  if (end === undefined) {
    end = '2022-04-03';
  }

  const valuesQuery = `
    ${select}
    FROM "${measurement}"
    WHERE 
    ${bySensor} AND
    time >= '${start}' AND 
    time < '${end}'
  `;

  console.log('valuesQuery', valuesQuery);

  influx.query(valuesQuery)
    .then( result => res.json({
      readings: result
    }) )
    .catch( error => {
      console.log('error', error);
      res.status(500).json({'error': error['message']});
    }).catch( error => {
      console.log('another error:', error);
    });

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

router.post('/system/', function (req, res) {
  console.log(req.body);
  const command = req.body.command;

  if( command === 'reboot'){
    exec('sudo reboot', function (error, stdout, stderr) {
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
  }else if(command === 'poweroff'){
    exec('sudo poweroff', function (error, stdout, stderr) {
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
    })
  }
  
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

