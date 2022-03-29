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

/*global d3*/
/*eslint no-undef: "error"*/
/*eslint-env browser*/

document.addEventListener("DOMContentLoaded", function() { 
    let startMinutes = 60;
    let endMinutes = 0;
    //step = deltaMinutes / 4
    
    let width = window.innerWidth;
    let height = width / 2;
    const margin = 5;
    const padding = 5;
    const adj = 30;

    // const URLSearch = new URLSearchParams(window.location.search);

    // const unitLUT = {
    //     "Temperature": '\xB0C',
    //     "Humidity": '%',
    //     "CO2": 'ppm',
    //     "TVOC": 'ppb',
    //     "PM 10.0": 'per 0.1L air',
    //     "PM 1.0": 'per 0.1L air',
    //     "PM 2.5": 'per 0.1L air'
    // };

    // const nameLUT = {
    //     "pm100_env": 'PM 10.0',
    //     "pm10_env": 'PM 1.0',
    //     "pm25_env": 'PM 2.5'
    // };
    
    // "2021-04-20T18:58:19.288Z"
    let timeConv = d3.timeParse("%Y-%m-%dT%H:%M:%S.%LZ");

    // from https://stackoverflow.com/a/1026087/6872193
    function capitalize(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    // fix spacing for navbar
    const bbox = d3.selectAll('.navbar').node().getBoundingClientRect();
    const navbarHeight = bbox.height;
    d3.select('body').style('padding-top',navbarHeight+'px');


    let loadData = undefined;

    d3.json('/settime/', {
        method: 'POST', 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({
            'datetime': (new Date()).toISOString()
        })
    }).then(function (data) {
        console.log('settime post response:', data);

        // TODO: check this if statement, it looks incorrect
        let seriesUrl = '/series/?showAll=true';

        d3.json(seriesUrl).then(function (allSeries) {
            console.log(allSeries);

            let allMeasurements = [...new Set(allSeries.map(d => d.measurement))];
            console.log(allMeasurements);
            let allSensors = [...new Set(allSeries.map(d => d.sensor_id))];

            // if there is only one sensor 
            // remove the sensor id from the name
            // TODO: consider the case of one sensor per measurement type
            allSeries = allSeries.map(function (item) {
                const id = `${item.measurement}_${item.sensor_id}`;
                let name = item.measurement;
                // if (name in nameLUT) {
                //     name = nameLUT[name];
                // } 
                if (allSensors.length > 1) {
                    name = `${name} (sensor #${item.sensor_id})`;
                }
                name = capitalize(name);
                
                // const latest = luxon.DateTime.fromISO(item.latest).setZone("Europe/London");
                const latest = luxon.DateTime.fromISO(item.latest);
                const now = luxon.DateTime.now();
                const age = luxon.Interval.fromDateTimes(latest, now);
                // if (age.invalid) {
                //     console.log('item.latest', item.latest)
                //     console.log('latest', latest.toHTTP(), '|', latest.toLocaleString(luxon.DateTime.DATETIME_FULL));
                //     console.log('now', now.toHTTP(), '|', latest.toLocaleString(luxon.DateTime.DATETIME_FULL));
                //     console.log('age', age.length('hours'));
                // }
                
                return {
                    'measurement': item.measurement,
                    'sensor_id': item.sensor_id,
                    'name': name,
                    'latest': latest,
                    'age': age,
                    'id': id,
                };
            });

            console.log('allSeries', allSeries);
            allSeries.sort(function (a, b) {return b['latest'] - a['latest'];});
            console.log('sorted allSeries', allSeries);

            // if (showAll === true) {
            //     allSeries = allSeries.sort(function (a, b) {
            //         return b.name.localeCompare(a.name);
            //     });
            // }
            
            const headtr = d3.select('#series-info')
                .append('thead')
                .append('tr');
            headtr.append('th').attr('scope',"col").html('Sensor ID');
            headtr.append('th').attr('scope',"col").html('Age');
            headtr.append('th').attr('scope',"col").html('Latest');
            headtr.append('th').attr('scope',"col").html('Measurement');
            headtr.append('th').attr('scope',"col").html('Name');

            const trs = d3.select('#series-info')
                .selectAll('tr')
                .data(allSeries)
                .enter()
                .append('tr')
                    .attr('class', "series");
            
            trs.append('td')
                .html(function (d) { return d.sensor_id; });

            trs.append('td')
                .html(function (d) { 
                    // let txt = '';
                    // const days = d.age.length('days');
                    // if (days < 1) {
                    //     const hours = d.age.length('hours');
                    //     txt = (Math.round(hours * 100) / 100) + ' hours';
                    // } else {
                    //     txt = Math.floor(days) + ' days';
                    // }
                    // return txt; 
                    return humanizeDuration(d.age.length('milliseconds'));
                });

            trs.append('td')
                .html(function (d) { return d.latest.toLocaleString(luxon.DateTime.DATETIME_FULL); });

            trs.append('td')
                .html(function (d) { return d.measurement; });
            
            trs.append('td')
                .html(function (d) { return d.name; });

            d3.select('div.main-loading').style('display', 'none');
        });
    });


});