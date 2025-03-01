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

const fs = require('fs');
const readline = require('readline');
const process = require('process');
const { DateTime, Interval } = require('luxon');
const argv = require('minimist')(process.argv.slice(2));

const db = require('better-sqlite3')('./db.sqlite3');

// influx code based on
// https://www.influxdata.com/blog/getting-started-with-node-influx/
const Influx = require('influx');
const { count } = require('console');

const influx = new Influx.InfluxDB({
  host: 'localhost',
  database: 'sdstore'
});

async function restore_file(f) {
    // TODO: load file and iterate over rows
    console.log(f);
    const rl = readline.createInterface({
        input: fs.createReadStream(f),
        crlfDelay: Infinity
      });    
    // rl.on( 'error', function (error) {console.log('stream error:', error)});
    rl.on('line', async function (line) {
        // console.log(line);
        const row = line.split(',');
        const date_string = row[0];
        const dt = DateTime.fromISO(date_string);
        const t = dt.toMillis();
        const sensor_id = row[1];
        const measurement = row[2];
        // const value = parseFloat(row[3]);
        const value = row[3];
        // console.log(row);
        console.log(t, sensor_id, measurement, value);
        try {
            const result = await influx.writePoints([
                {
                    measurement: measurement,
                    tags: { sensor_id: sensor_id },
                    fields: { value: value },
                    timestamp: t
                }
            ]);
            console.log(result);
        } catch(error) {
            console.log('influx error:', error);
        }
    });
    rl.on('close', function (error) {console.log('close:', error)});
}


async function run() {
    fs.readdir(
        argv['path'], 
        {'withFileTypes': true}, function (error, files) {
        if (error) {
            console.log('readdir error:', error)
            return;
        }
        console.log('files', files);
        for (const f of files) {
            console.log(f);
            restore_file(`${argv['path']}/${f.name}`);
        }
    });
}

run();
