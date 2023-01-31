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
    
    let width = window.innerWidth;
    let height = width / 2;
    const margin = 5;
    const padding = 5;
    const adj = 30;

    const OFFSETDB = 100;

    let timeConv = d3.timeParse("%Y-%m-%dT%H:%M:%S.%LZ");

    // from https://stackoverflow.com/a/1026087/6872193
    function capitalize(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    d3.select('button#download-button').on('click', async function () {
        console.log('button#download-button');
     
        let csv_content = "data:text/csv;charset=utf-8,";
        const now = luxon.DateTime.now();
        const today = new luxon.DateTime(now.year, now.month, now.day);
        const start = today.minus({weeks: 8});
        const total_days = luxon.Interval.fromDateTimes(start, today).length('days');

        let allSeries = await d3.json(seriesUrl) //.then( () => saveData(allSeries));

        console.log(allSeries)

        const promises = allSeries.map(m => getData(m));
        Promise.all(promises).then( () => {
            const encoded_uri = encodeURI(csv_content);
            var link = document.createElement("a");
            link.setAttribute("href", encoded_uri);
            link.setAttribute("download", `all_data.csv`);
            document.body.appendChild(link); // Required for FF
            
            link.click(); // This will download the data file named "my_data.csv".  
        });

        function getData(h) {
            sensor_id = h.sensor_id;
            measurement = h.measurement;

            url = `/measurement/${measurement}/sensor/${sensor_id}/rawdata/`;
           
            let all_data = [];
            // for (let d=0; d<total_days; d+=1) {
            //     const curr = start.plus({'days': d});
            //     const next = curr.plus({'days': 1});
            //     console.log(`d: ${d}, curr: ${curr.toFormat('yyyy-LL-dd')}, next: ${next.toFormat('yyyy-LL-dd')}`);
            //     const query = `?start=${curr.toFormat('yyyy-LL-dd')}&end=${next.toFormat('yyyy-LL-dd')}`;
            const query = `?start=${start.toFormat('yyyy-LL-dd')}&end=${now.toFormat('yyyy-LL-dd')}`;

            return d3.json(url+query).then( data =>{
                console.log('data:', data);
                all_data = all_data.concat(data.readings);
                all_data.forEach(function(row) {
                    csv_content += `${row.time},${row.value},${h.sensor_id},${h.measurement}` + "\r\n";
                });    
            });
            // }
            console.log('all_data:', all_data);
        }
      
    });

    let loadData = undefined;

    // TODO: check this if statement, it looks incorrect
    let seriesUrl = '/series/?showAll=true';

    d3.json(seriesUrl).then(function (allSeries) {
        console.log(allSeries);
    
        sensingMeasure = [];
        rssi = [];
        battery = [];

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
                'value': item.value,
                'age': age,
                'id': id,
            };
        });

        console.log('allSeries', allSeries);
        allSeries.sort(function (a, b) {return b['latest'] - a['latest'];});
        // allSeries.splice(0, 0, {});
        console.log('sorted allSeries', allSeries);

        allSeries.filter(p => {
            if(p.measurement !== 'battery' && p.measurement !== 'rssi' ){
                sensingMeasure.push(p);
            }else if(p.measurement === 'battery'){
                battery.push(p);
            }else if( p.measurement === 'rssi'){
                rssi.push(p);                
            }
        })
     
        const headSensors = d3.select('#sensor-alias')
            .append('thead')
            .append('tr');
        headSensors.append('th').attr('scope',"col").html('Sensor ID');
        headSensors.append('th').attr('scope',"col").html('Alias');
        headSensors.append('th').attr('scope',"col").html('');

        const trsSensors = d3.select('#sensor-alias').append('tbody')
            .selectAll(null)
            .data(allSensors)
            .join('tr')
             .attr('class', "series");
        
        trsSensors.append('td')
            .html(function (d) { return d; })
            .style('text-align','center')
            .style('vertical-align','middle')
        
        trsSensors.append('td')
            .append('input')
            .attr('type','text')
            .attr('class','form-control')
            .attr('id', d => { return "sensor"+d; })
            .attr('placeholder','Add name here e.g. Kitchen')
        
        trsSensors.append('td')
            .append('button')
            .html('Save')
            .attr('id', d =>{ return 'submit'+d } )
            .attr('type','submit')
            .attr('class','btn btn-primary')
            .on('click', d =>{
                console.log(d);
            })
            //type="submit" class=""

        const headtr = d3.select('#series-info')
            .append('thead')
            .append('tr');
        headtr.append('th').attr('scope',"col").html('Sensor ID');
        headtr.append('th').attr('scope',"col").html('Age');
        headtr.append('th').attr('scope',"col").html('Latest');
        headtr.append('th').attr('scope',"col").html('Value');
        headtr.append('th').attr('scope',"col").html('Measurement');

        const trs = d3.select('#series-info').append('tbody')
            .selectAll(null)
            .data(sensingMeasure)
            .enter()
            .append('tr')
                .attr('class', "series");
        
        trs.append('td')
            .html(function (d) { return d.sensor_id; });

        trs.append('td')
            .html(function (d) { 
                return humanizeDuration(d.age.length('milliseconds'));
            });

        trs.append('td')
            .html(function (d) { return d.latest.toLocaleString(luxon.DateTime.DATETIME_FULL); });

        trs.append('td')
            .html(function (d) { return d.value.toFixed(2); });
        
        trs.append('td')
            .html(function (d) { return d.measurement; });
       

        const headBatt = d3.select('#battery-status')
            .append('thead')
            .append('tr');
        headBatt.append('th').attr('scope',"col").html('Sensor ID');
        headBatt.append('th').attr('scope',"col").html('Value');
        headBatt.append('th').attr('scope',"col").html('Age');

        trsBatt = d3.select('#battery-status').append('tbody')
            .selectAll(null)
            .data(battery)
            .join('tr')
            .attr('class', "series");

        trsBatt.style('opacity', d=> {
            if( d.age.length('milliseconds') > 60*60*1000  ){
                return '0.5';
            }else{
                return '1'
            }
        });

        trsBatt.append('td')
            .html(function (d) { return d.sensor_id; });
        trsBatt.append('td')
            .html(function (d) { return d.value + " "; })
            .style('color', d =>{
                if( (d.value) === 1) { return 'green' }
                if( (d.value) < 500  ){
                    return 'darkred'
                }else if( (d.value) < 600){
                    return 'orange'
                }else {
                    return 'green'
                }
            }).append('label')    
            .style('background', d =>{
                if( (d.value) === 1) { return 'green' }
                if( (d.value) < 500  ){
                    return 'darkred'
                }else if( (d.value) < 600){
                    return 'orange'
                }else {
                    return 'green'
                }
            }).style("border-radius","100% 100%")
            .style("width", '5px')
            .style("height", '5px')
            .style("padding",'6px')
        trsBatt.append('td')
            .html(function (d) { 
                console.log(d.age )
                if( d.age.length('milliseconds') > 60*60*1000  ){
                    return "(more than an hour ago)";
                }else{
                    return '('+humanizeDuration(d.age.length('milliseconds'))+")" ;
                }
            })  

        const headSig = d3.select('#signal-quality')
            .append('thead')
            .append('tr');
        headSig.append('th').attr('scope',"col").html('Sensor ID');
        headSig.append('th').attr('scope',"col").html('Strength');
        headSig.append('th').attr('scope',"col").html('Age');

        trsSign = d3.select('#signal-quality').append('tbody')
            .selectAll(null)
            .data(rssi)
            .join('tr')
            .attr('class', "series");
        
        trsSign.style('opacity', d=> {
            if( d.age.length('milliseconds') > 60*60*1000  ){
                return '0.5';
            }else{
                return '1'
            }
        });

        trsSign.append('td')
            .html(function (d) { return d.sensor_id; });
        trsSign.append('td')
            .html(function (d) { return d.value + OFFSETDB + " "; })
            .style('color', d =>{
                if( (d.value + OFFSETDB) < 10 ){
                    return 'darkred'
                }else if( (d.value + OFFSETDB) < 30){
                    return 'orange'
                }else {
                    return 'green'
                }
            }).append('label')    
            .style('background', d =>{
                if( (d.value + OFFSETDB) < 10 ){
                    return 'darkred'
                }else if( (d.value + OFFSETDB) < 30){
                    return 'orange'
                }else {
                    return 'green'
                }
            }).style("border-radius","100% 100%")
            .style("width", '5px')
            .style("height", '5px')
            .style("padding",'6px')
        trsSign.append('td')
            .html(function (d) { 
                if( d.age.length('milliseconds') > 60*60*1000  ){
                    return "(more than an hour ago)";
                }else{
                    return '('+humanizeDuration(d.age.length('milliseconds'))+")" ;
                }
            })

        d3.select('div.main-loading').style('display', 'none');
    });


});