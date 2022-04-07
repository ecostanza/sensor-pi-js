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

    const URLSearch = new URLSearchParams(window.location.search);
    // let showAll = false;
    let showAll = true;
    if (URLSearch.has('showAll')) {
        const showAllParam = URLSearch.get('showAll').toLowerCase();
        showAll = (showAllParam.toLowerCase() === 'true') 
    }
    let daysParam = undefined;
    if (URLSearch.has('days')) {
        daysParam = URLSearch.get('days');
    }

    const unitLUT = {
        "Temperature": '\xB0C',
        "Humidity": '%',
        "CO2": 'ppm',
        "TVOC": 'ppb',
        "PM 10.0": 'per 0.1L air',
        "PM 1.0": 'per 0.1L air',
        "PM 2.5": 'per 0.1L air'
    };

    const nameLUT = {
        "pm100_env": 'PM 10.0',
        "pm10_env": 'PM 1.0',
        "pm25_env": 'PM 2.5'
    };
    
    // "2021-04-20T18:58:19.288Z"
    //let timeConv = d3.timeParse("%Y-%m-%dT%H:%M:%S.%LZ");

    // from https://stackoverflow.com/a/1026087/6872193
    function capitalize(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    // fix spacing for navbar
    const bbox = d3.selectAll('.navbar').node().getBoundingClientRect();
    const navbarHeight = bbox.height;
    d3.select('body').style('padding-top',navbarHeight+'px');

    const appendSvg = function (measurement) {
        let name = measurement.name;
        // if (name in unitLUT) {
        //     name = `${name} (${unitLUT[name]})`;
        // }

        d3.select("div#container")
            .append("h4")
            .attr('id', measurement.id)
            .text(name);

        d3.select("div#container")
            .append("svg")
            .attr('id', measurement.id + 'Chart')
            .attr("preserveAspectRatio", "xMinYMin meet")
            .attr("viewBox", "-"
                + 1.5 * adj + " -"
                + adj + " "
                + (width + adj *3) + " "
                + (height + adj*4))
            .style("padding", padding)
            .style("margin", margin)
            .classed("svg-content", true);
    };

    const loadMeasurementData = function (series) {
        const measurement = series.measurement;
        const sensor_id = series.sensor_id;
        // console.log('start:', startMinutes, 'end:', endMinutes);
        // console.log('loading', series);

        let dataUrl = `/measurement/${measurement}/sensor/${sensor_id}/data/?start=-${startMinutes}`;
        if (endMinutes > 0) {
            dataUrl = dataUrl + `&end=-${endMinutes}`;
        }
        if (showAll === true) {
            dataUrl = dataUrl + `&showAll=true`;
        } else {
            dataUrl = dataUrl + `&recent=false`;
        }

        const barW = 20;
        const nPoints = Math.floor(width / barW);
        dataUrl += `&points=${nPoints}`;

        return d3.json(dataUrl).then(function (response) {
            let data = response.readings;

            // console.log(series.name, 'min, max', response.min, response.max);
            // console.log(response);
            let offset = 0;
            if (series.name.startsWith('Temperature')) {
                offset = -3.2;
            }

            data = data.map(function (d) {
                let v = +d.value + offset;
                if (d.value === null) {
                    v = null;
                }
                return {
                    time: luxon.DateTime.fromISO(d.time).toJSDate(),//timeConv(d.time),
                    value: v
                }
            });

            // console.log('filtered');
            // console.log(data);

            //const bisectTime = d3.bisector(function(d) { return d.time; }).left;
            const tzOffset = 0;//(new Date()).getTimezoneOffset() * 60000;

            let xScale = d3.scaleTime(
                d3.extent(data, d => new Date(d.time.getTime() - tzOffset)),
                [0, width]
            );
            let yScale = d3.scaleLinear(
                // [(0), 1.1 * d3.max(data, d => +d.value)],
                [(0.9 * (response.min + offset)), 1.1 * (response.max + offset)],
                [height, 0]
            );
            
            let xAxis = d3.axisBottom()
                .ticks(5)
                .tickFormat(d3.timeFormat('%b %d %H:%M'))
                .scale(xScale);
            let yAxis = d3.axisLeft()
                .scale(yScale); 
            
            let svg = d3.select('svg#' + series.id + 'Chart');
            svg.selectAll("*").remove();

            svg.append("g")
                .attr("class", "axis")
                .attr("transform", "translate(0," + height + ")")
                .call(xAxis)
                    .selectAll("text")	
                    .style("text-anchor", "end")
                    .attr("dx", "-.8em")
                    .attr("dy", ".15em")
                    .attr("transform", "rotate(-45)");
        
            let label = series.name;
            if (label.includes(' (sensor')) {
                label = label.split(' (sensor')[0];
            }
            if (label in unitLUT) {
                label = `${series.name} (${unitLUT[label]})`;
            } else {
                label = series.name;
            }
    
            svg.append("g")
                .attr("class", "axis")
                .call(yAxis)
                .append("text")
                    .attr("transform", "rotate(-90)")
                    .attr("dy", ".75em")
                    .attr("y", 6)
                    .style("text-anchor", "end")
                    .text(label);


            const tooltip = svg.append('g')
                .style('display', 'none');

            tooltip
                .append('rect')
                .style('display', 'block')
                .attr('x', 0)
                .attr('y', -20)
                .attr('width', 140)
                .attr('height', 20)
                .attr('fill', 'rgba(240, 240, 240, .7)');

            tooltip
                .append('text')
                .style('display', 'block')
                .attr('x', 5)
                .attr('y', -5)
                .text('hello');

            svg.selectAll('rect')
                .data(data)
                .enter().append("rect")
                    .style("fill", "steelblue")
                    .attr("x", function(d) { return xScale(new Date(d.time.getTime() - tzOffset)); })
                    .attr("width", 10) //x.rangeBand())
                    .attr("y", function(d) { return yScale(d.value); })
                    .attr("height", function(d) {
                        if (height - yScale(d.value) < 0) {
                            console.log(d);
                            return 0;
                        } 
                        if (d.value === null) {
                            return 0;
                        } else {
                            return height - yScale(d.value);
                        }
                    })
                    .on("touchmove mousemove", function (event, d) {
                        // console.log(event, d);
                        const time = new Date(d.time.getTime() - tzOffset);
                        let x = xScale(time);
                        if (x > (width - 140)) {
                            x -= 130;
                        }
                        const y = yScale(d.value) - 20;
                        let txt = `${d3.timeFormat('%b %d %H:%M')(time)}, ${d.value.toFixed(1)}`;

                        // let name = '';
                        if (series.name in unitLUT) {
                            txt = txt + ' ' + unitLUT[series.name];
                        }
                        // console.log(txt);
                        
                        tooltip.selectAll("text")
                            .data([null])
                            .join("text")
                            .text(txt);
                        
                        const txt_w = tooltip.selectAll("text").node().getBBox().width;
                        tooltip.selectAll("rect")
                            .attr('width', txt_w + 10);

                        tooltip
                            .style('display', 'block')
                            .attr("transform", `translate(${x},${y})`)
                            .raise();
                    })
                    .on("touchend mouseleave touchcancel", function() {
                        //console.log('mouseleave');
                        tooltip.style('display', 'none');
                    });
            
            /*
            svg.selectAll('circle')
                .data(data)
                .enter().append("circle")
                    .attr("class", "dot")
                    .attr("cx", d => xScale(new Date(d.time.getTime() - tzOffset)))
                    .attr("cy", d => yScale(d.value))
                    .attr('r', function (d) {
                        if (d.value !== null) {
                            return 3;
                        } else {
                            return 0;
                        }
                    });

            let line = d3.line()
                .defined(d => (d.value) && (d.value !== null))
                .x(d => xScale(new Date(d.time.getTime() - tzOffset)))
                .y(d => yScale(d.value));
            
            svg.append("path")
                .datum(data)
                .attr("d", line);
            */

            // const tooltip = svg.append('g');

            // tooltip
            //     .append('rect')
            //     .attr('x', 0)
            //     .attr('y', -20)
            //     .attr('width', 140)
            //     .attr('height', 20)
            //     .attr('fill', 'rgba(240, 240, 240, .7)');

            // tooltip
            //     .append('text')
            //     .attr('x', 5)
            //     .attr('y', -5)
            //     .style('display', 'none')
            //     .text('hello');

            // svg.on("touchmove mousemove", function(event) {
            //     const x = d3.pointer(event, this)[0];
            //     const time = xScale.invert(x);
            //     const index = bisectTime(data, time);
            //     if (index === undefined || data[index] === undefined) {return;}
            //     const value = data[index].value;
            //     const y = yScale(value);

            //     // console.log(x, time, index, value, y);

            //     tooltip.selectAll("text")
            //         .data([null])
            //         .join("text")
            //         .text(`${d3.timeFormat('%b %d %H:%M')(time)}, ${value.toFixed(1)}`);

            //     tooltip
            //         .style('display', null)
            //         .attr("transform", `translate(${x},${y})`);
            //     //     .call(callout, `${formatValue(value)} ${formatDate(date)}`);
            // });
            
            // svg.on("touchend mouseleave touchcancel", function() {
            //     tooltip.style('display', 'none');
            // });
                                
        });
    }

    d3.select('#intervalRadio').on('change', function () {
        console.log('changed');
        const selectedId = d3.select('#intervalRadio :checked').attr('id');
        const interval = d3.select(`label[for=${selectedId}]`).node().innerHTML;

        endMinutes = 0;
        d3.select('#laterBtn').node().disabled = true;
        
        const intervalLUT = {
            '1h': 60,
            '12h': 12 * 60,
            '1d': 24 * 60,
            '7d': 7 * 24 * 60
        };

        startMinutes = intervalLUT[interval];
        
        loadData();
    });

    // deltaMinutes is used also for the periodic refresh
    let deltaMinutes = 60;

    d3.select('#earlierBtn').on('click', function () {
        console.log('earlier clicked');

        d3.select('#laterBtn').node().disabled = false;

        deltaMinutes = startMinutes - endMinutes;
        const step = deltaMinutes / 4;
        endMinutes = endMinutes + step;
        startMinutes = startMinutes + step;
                
        loadData();
    });

    d3.select('#laterBtn').on('click', function () {
        console.log('later clicked');

        deltaMinutes = startMinutes - endMinutes;
        const step = deltaMinutes / 4;
        endMinutes = endMinutes - step;
        startMinutes = startMinutes - step;
        
        if (endMinutes === 0) {
            console.log('now');
            d3.select('#laterBtn').node().disabled = true;
        }
        
        loadData();
    });

    setInterval(
        function () {
            if (endMinutes === 0) {
                loadData();
            }
        },
        // deltaMinutes / 60 * 60 * 1000
        deltaMinutes * 2 * 1000
    );

    let loadData = undefined;
    let _series = [];

    d3.select('#laterBtn').node().disabled = true;

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
        if (showAll !== true) {
            seriesUrl = '/series/';
        }
        if (daysParam !== undefined) {
            seriesUrl = seriesUrl + '&days=' + daysParam;
        }

        d3.json(seriesUrl).then(function (allSeries) {
            console.log(allSeries);

            if (showAll !== true) {
                // filter out some sensor types
                const toKeep = [
                    "temperature",
                    "humidity",
                    "CO2",
                    "TVOC",
                    "pm100_env",
                    "pm10_env",
                    "pm25_env",
                    "battery"
                ];
                allSeries = allSeries.filter(function (d) {
                    return toKeep.includes(d.measurement);
                });
                // sort allSeries based on the toKeep order
                // from https://stackoverflow.com/a/44063445/6872193
                allSeries.sort( function(a, b) {
                    return toKeep.indexOf(a.measurement) - toKeep.indexOf(b.measurement);
                });                
            }

            let allMeasurements = [...new Set(allSeries.map(d => d.measurement))];
            console.log(allMeasurements);
            let allSensors = [...new Set(allSeries.map(d => d.sensor_id))];

            /*
            // TODO: toggle sort order
            // see https://stackoverflow.com/a/29090209/6872193
            if (allSensors.length === 1) {
                d3.select('div#sortRadio').remove();
            } else {
                d3.select('div#sortRadio').on('change', function () {
                    const selectedId = d3.select('#sortRadio :checked').attr('id');
                    const sortBy = d3.select(`label[for=${selectedId}]`).node().innerHTML;

                    if (sortBy === 'by type') {
                        d3.select("div#container").selectAll("*").remove();
                        allSeries.sortBy()
                    } else {

                    }
                });                    
            }
            */

            // if there is only one sensor 
            // remove the sensor id from the name
            // TODO: consider the case of one sensor per measurement type
            allSeries = allSeries.map(function (item) {
                const id = `${item.measurement}_${item.sensor_id}`;
                let name = item.measurement;
                if (name in nameLUT) {
                    name = nameLUT[name];
                } 
                if (allSensors.length > 1) {
                    name = `${name} (sensor #${item.sensor_id})`;
                }
                name = capitalize(name);
                
                return {
                    'measurement': item.measurement,
                    'sensor_id': item.sensor_id,
                    'name': name,
                    'id': id,
                };
            });

            if (showAll === true) {
                allSeries = allSeries.sort(function (a, b) {
                    return b.name.localeCompare(a.name);
                });
            }
            
            // allSeries.forEach(m => appendSvg(m));

            loadData = function () {
                d3.select("div#container").selectAll('svg').remove();
                d3.select("div#container").selectAll('h4').remove();
                _series.forEach(m => appendSvg(m));
                d3.select('div.main-loading').style('display', 'block');
                const promises = _series.map(m => loadMeasurementData(m));
                Promise.all(promises).then(function () {
                    console.log('all loaded');
                    d3.select('div.main-loading').style('display', 'none');
                });
            };

            _series = allSeries.map(function (d) {return d;});

            loadData();

            d3.select('select#measurementSelect')
                .selectAll('option')
                .data(allMeasurements)
                .enter()
                .append('option')
                    .attr('value', function (d) {return d; } )
                    .html(function (d) { return d; });

            d3.select('select#sensorSelect')
                .selectAll('option')
                .data(allSensors)
                .enter()
                .append('option')
                    .attr('value', function (d) {return d; } )
                    .html(function (d) { return d; });

            let handle_select = function () {
                const measurement = d3.select('select#measurementSelect').node().value;
                const sensor_id = d3.select('select#sensorSelect').node().value;
                _series = allSeries.map(function (serie) {return serie;});
                if (measurement !== 'Any Measurement') {
                    _series = _series.filter(function (serie) {return serie.measurement === measurement;});
                }
                if (sensor_id !== 'Any Sensor') {
                    _series = _series.filter(function (serie) {return serie.sensor_id === sensor_id;});
                }
                loadData();
            };
            
            d3.select('select#measurementSelect').on('change', handle_select);
            d3.select('select#sensorSelect').on('change', handle_select);
                    
        });
    });


});