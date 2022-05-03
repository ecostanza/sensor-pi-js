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

function get_and_delete_annotations (dirname, remove=remove) {
    const annotation_fields = [
        {'name': 'id', 'required': false, 'auto': true},
        {'name': 'start', 'required': true, 'auto': false},
        {'name': 'duration_seconds', 'required': true, 'auto': false},
        
        {'name': 'type', 'required': true, 'auto': false},
        {'name': 'description', 'required': false, 'auto': false},
        
        {'name': 'consumption', 'required': false, 'auto': false},
        
        {'name': 'flexibility', 'required': false, 'auto': false},
        
        {'name': 'measurement', 'required': true, 'auto': false},
        {'name': 'sensor', 'required': true, 'auto': false},
        
        {'name': 'createdAt', 'required': false, 'auto': true},
        {'name': 'updatedAt', 'required': false, 'auto': true}
    ];
    
    try {
        const annotation_columns = annotation_fields.map(f => f['name']);
        const query = `SELECT ${annotation_columns.join()} from annotations;`;
        // console.log('query:', query);
        const select = db.prepare(query);
        // console.log('prepare returned:', select);
        const annotations = select.all();
        console.log('annotations:', annotations);
        // return res.json(annotations);
        
        // write to file
        const fname = `annotations.csv`;

        // headers
        fs.writeFile(
            `${dirname}/${fname}`, 
            `${annotation_columns.join(",")}\n`, 
            { flag: 'a+' }, 
            function (error) {
                if (error !== null) {
                    console.log('file error', error);
                    throw error;
                }
            });

        annotations.forEach(function (a) {
            const values = annotation_columns.map(function (c) {
                return a[c];
            })
            fs.writeFile(
                `${dirname}/${fname}`, 
                `${values.join(",")}\n`, 
                { flag: 'a+' }, 
                function (error) {
                    if (error !== null) {
                        console.log('file error', error);
                        throw error;
                    }
                });

            if (remove === true) {
                const query = `DELETE from annotations where id = ${a['id']}`;
                const statment = db.prepare(query);
                const result = statment.run();
                console.log('delete result:', result);
            }
        });

        // delete


    } catch (error) {
        console.log('annotations error:', error);
        // return res.json({'error': error});
    }
    
}

async function get_and_delete_serie_data (dirname, measurement, sensor, remove=false) {
    // TODO: change this function so that it goes day by day
    // get first and last
    const firstQuery = `SELECT FIRST(*) from "${measurement}"`;
    const lastQuery = `SELECT LAST(*) from "${measurement}"`;

    let counter = 0;
    
    // console.log('valuesQuery', valuesQuery);
    // console.log('firstQuery', firstQuery);
    // console.log('lastQuery', lastQuery);
  
    let retrieved = {'length': 1};
    try {
        const firstResponse = await influx.query(firstQuery);
        const start_dt = DateTime.fromISO(firstResponse[0].time.toNanoISOString());
        let start = DateTime.utc(start_dt.year, start_dt.month, start_dt.day);
        if (argv['start'] !== undefined) {
            const startConstraint = DateTime.fromFormat(argv['start'], 'yyyy-LL-dd');
            if (start < startConstraint) {
                start = startConstraint;
            }
        }
        // console.log('start:',start);
        console.log('start:', start.toISODate());

        const lastResponse = await influx.query(lastQuery);
        const end_dt = DateTime.fromISO(lastResponse[0].time.toNanoISOString());
        let end = DateTime.utc(end_dt.year, end_dt.month, end_dt.day);
        if (argv['end'] !== undefined) {
            const endConstraint = DateTime.fromFormat(argv['end'], 'yyyy-LL-dd');
            if (end > endConstraint) {
                end = endConstraint;
            }
        }
        // console.log('end:', end);
        console.log('end:', end.toISODate());

        const total_days = Interval.fromDateTimes(start, end).length('days');

        let curr = start;
        while (curr < end) {
            const next = curr.plus({days: 1});

            const valuesQuery = `
                SELECT "time", "value"
                FROM "${measurement}"
                WHERE "sensor_id" = '${sensor}' AND
                time >= '${curr.toFormat('yyyy-LL-dd')}' AND
                time < '${next.toFormat('yyyy-LL-dd')}'
            `;

            // console.log('valuesQuery:', valuesQuery);

            retrieved = await influx.query(valuesQuery);
            if (retrieved.length > 0) {
                const days = Interval.fromDateTimes(start, curr).length('days');
                // console.log('days:', days);
                // console.log('total_days:', total_days);
                process.stdout.write(`${Math.round(100*days/total_days)}% ${curr.toFormat('yyyy LL dd')}, retrieved.length: ${retrieved.length}\r`);
                
                const csv_data = retrieved.groupRows.map(function (item) {
                    return item.rows.map(function (row) {
                        const txt = `${row.time.toISOString()},${sensor},${item.name},${row.value}`;
                        // console.log(txt);
                        return txt;
                    }).join("\n");
                })

                // console.log(csv_data);
                // console.log( csv_data.join("\n") );
                // process.exit()
                const fname = `${curr.toFormat('yyyyLLdd')}.csv`;
                // write to file
                fs.writeFile(
                    `${dirname}/${fname}`, 
                    `${csv_data.join("\n")}\n`, 
                    { flag: 'a+' }, 
                    function (error) {
                        if (error !== null) {
                            console.log('file error', error);
                            throw error;
                        }
                    });
                
                // delete
                if (remove === true) {
                    const deleteQuery = `
                    DELETE
                    FROM "${measurement}"
                    WHERE "sensor_id" = '${sensor}' AND
                    time >= '${curr.toFormat('yyyy-LL-dd')}' AND
                    time < '${next.toFormat('yyyy-LL-dd')}'
                    `;
                    // console.log('deleteQuery:', deleteQuery);
                    const deleted = await influx.query(deleteQuery);
                    // console.log('deleted:', deleted);
                }
            }
            counter = counter + retrieved.length;
            curr = next;
        }
    } catch ( error ) {
        console.log('error', error);
    }  
    return counter;
}

async function get_all_series () {
    const query = `SELECT LAST(value) FROM /.*/ GROUP BY *`;
    try {
        const result = await influx.query(query);
        const rearranged = result.groupRows.map(function (item) {
            return {
                'measurement': item.name,
                'sensor_id': item.tags.sensor_id//,
                //'latest': item.rows[0].time
            };
        });
        return rearranged;
    } catch(error) {
        console.log('error:', error);
        return [];
    } 
}

async function run () {
    // create folder
    const now = DateTime.now();
    const dirname = `export_${now.toFormat('yyyyLLddHHmmss')}`;
    fs.mkdir(dirname, function (err) {
        if (err) {
            if (err.code === 'EEXIST') {
                return;
            } else {
                console.log('mkdir error:', err);
                throw err;
            }
        }
    });

    const series = await get_all_series();

    let remove = true;
    if (argv['remove'] === false) {
        remove = false;
    }
    
    for(element of series) {
        console.log(element);
        await get_and_delete_serie_data(dirname, element.measurement, element.sensor_id, remove=remove);
    }
    // get_and_delete_serie_data(dirname, series[0].measurement, series[0].sensor_id);

    get_and_delete_annotations(dirname, remove=remove);
}

run();
