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

    let timeOfInactivity = 5*60*1000;

    const OFFSETDB = 100;

    let timeConv = d3.timeParse("%Y-%m-%dT%H:%M:%S.%LZ");

    // from https://stackoverflow.com/a/1026087/6872193
    function capitalize(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    d3.select('button#download-button').on('click', async function () {
        console.log('button#download-button');
        
        d3.select('#spinner').style('display', 'block');

        let csv_content = "data:text/csv;charset=utf-8,";

        const now = luxon.DateTime.now();
        const today = new luxon.DateTime(now.year, now.month, now.day);
        tomorrow = today.plus({days:1})
        const start = today.minus({weeks: 10});
        const total_days = luxon.Interval.fromDateTimes(start, today).length('days');
        let all_data = [];

        let allSeries = await d3.json(seriesUrl);
        allSeries = allSeries.filter(function (s) {
            return ['temperature','humidity','battery','rssi','sampling_period'].includes(s.measurement);
        });
        console.log('allSeries', allSeries);

        for( j in allSeries){
            url = `/measurement/${allSeries[j].measurement}/sensor/${allSeries[j].sensor_id}/rawdata/`;

            for (let d=0; d<=total_days; d+=1) {
                const curr = start.plus({'days': d});
                const next = curr.plus({'days': 1});

                const query = `?start=${curr.toFormat('yyyy-LL-dd')}&end=${next.toFormat('yyyy-LL-dd')}&showAll=true&points=80`;
                const response = await d3.json(url+query);
                console.log('response:', response);
                all_data = all_data.concat(response.readings);

                response.readings.forEach(function(row) {
                    csv_content += `${row.time},${row.value},${allSeries[j].sensor_id},${allSeries[j].measurement}` + "\r\n";
                });    

            }
        }
      
        const encoded_uri = encodeURI(csv_content);
        var link = document.createElement("a");
        link.setAttribute("href", encoded_uri);
        link.setAttribute("download", `all_data.csv`);
        document.body.appendChild(link); // Required for FF
        
        link.click(); // This will download the data file named "my_data.csv".  
         d3.select('#spinner').style('display', 'none');
  /*
        function getData(h) {
            sensor_id = h.sensor_id;
            measurement = h.measurement;

            url = `/measurement/${measurement}/sensor/${sensor_id}/rawdata/`;
            console.log('url', url);
           
            let all_data = [];
            const query = `?start=${start.toFormat('yyyy-LL-dd')}&end=${tomorrow.toFormat('yyyy-LL-dd')}`;

            return d3.json(url+query).then( data =>{
                console.log('data:', data);
                all_data = all_data.concat(data.readings);
                all_data.forEach(function(row) {
                    csv_content += `${row.time},${row.value},${h.sensor_id},${h.measurement}` + "\r\n";
                });    
            });
            console.log('all_data:', all_data);
        }
      */
    });

    d3.select('button#download-annotations-button').on('click', exportCSVAnnotation);

    d3.select('button#download-config-button').on('click', async function(){
        d3.select('#spinner').style('display', 'block');

        let csvContent = "data:text/csv;charset=utf-8," 

        sensorLabels = await d3.json('/sensors')
        console.log(sensorLabels)
        pp = '';
        for (const key in sensorLabels[0]) {
            pp += key + ',';
        }
        pp = pp.slice(0, -1); 
        csvContent += pp + "\n";

        sensorLabels.forEach( (e,i) => {
            pp = '';
            for (const key in e) {
                    sanitised = (e[key]+'').replace(/,/g,' ')
                    pp += sanitised + ',';
            }
            pp = pp.slice(0, -1);
            csvContent += pp + "\n";
        });

        //https://stackoverflow.com/questions/14964035/how-to-export-javascript-array-info-to-csv-on-client-side
        var encodedUri = encodeURI(csvContent);
        var link = document.createElement("a");
        link.setAttribute("href", encodedUri);

        dateToday = new Date().getDate() +"-" + new Date().getMonth()+ "-"+new Date().getFullYear();
        link.setAttribute("download", "config-"+dateToday+".csv");
        document.body.appendChild(link); // Required for FF

        d3.select('#spinner').style('display','none')

        link.click(); // This will download the data file named "my_data.csv".
    
        d3.select('#spinner').style('display', 'none');

    })

    async function exportCSVAnnotation(){
        resetTimeOfInactivity();

        d3.select('#spinner').style('display', 'block');

        let csvContent = "data:text/csv;charset=utf-8," 
        
        result = await d3.json('/annotations');

        // save label names
        pp = '';
        for (const key in result[0]) {
            pp += key + ',';
        }
        pp = pp.slice(0, -1); 
        csvContent += pp + "\n";

        // save data 
        result.forEach( (e,i) => {
            pp = '';
            for (const key in e) {
                    sanitised = (e[key]+'').replace(/,/g,' ')
                    pp += sanitised + ',';
            }
            pp = pp.slice(0, -1);
            csvContent += pp + "\n";
        });
        
        //https://stackoverflow.com/questions/14964035/how-to-export-javascript-array-info-to-csv-on-client-side
        var encodedUri = encodeURI(csvContent);
        var link = document.createElement("a");
        link.setAttribute("href", encodedUri);

        dateToday = new Date().getDate() +"-" + new Date().getMonth()+ "-"+new Date().getFullYear();
        link.setAttribute("download", "annotations-"+dateToday+".csv");
        document.body.appendChild(link); // Required for FF

        d3.select('#spinner').style('display','none')

        link.click(); // This will download the data file named "my_data.csv".
    
        d3.select('#spinner').style('display', 'none');

    }  

    let loadData = undefined;

    // TODO: check this if statement, it looks incorrect
    let seriesUrl = '/series/?showAll=true&showUnexpected=true';

    d3.json(seriesUrl).then( async function (allSeries) {
        console.log(allSeries);
        
        allSeries = allSeries.filter( f=>{
            return (f.sensor_id > 1 && f.sensor_id < 120);
        })
        
        data = [];
        dataMeasurements = [];

        let allMeasurements = [...new Set(allSeries.map(d => d.measurement))];

        // Remove the operational measurements from the array
        allMeasurements.splice(allMeasurements.indexOf('battery'), 1);
        allMeasurements.splice(allMeasurements.indexOf('rssi'), 1);
        allMeasurements.splice(allMeasurements.indexOf('sampling_period'), 1);
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
            
            const latest = luxon.DateTime.fromISO(item.latest);
            const now = luxon.DateTime.now();
            const age = luxon.Interval.fromDateTimes(latest, now);
            
            return {
                'measurement': item.measurement,
                'sensor_id': item.sensor_id,
                'name': name,
                'latest': latest,
                'value': item.value,
                'isexpected': item.expected,
                'age': age,
                'id': id,
            };
        });

        console.log('allSeries', allSeries);
        allSeries.sort(function (a, b) {return b['latest'] - a['latest'];});

        data = d3.rollup(allSeries, v => v, d=> d.sensor_id)
        allSeries.filter(p => {
            if(p.measurement !== 'battery' && p.measurement !== 'rssi' && p.measurement !== 'sampling_period'){
                dataMeasurements.push(p);
            }
        });

        sensorLabels = await d3.json('/sensors/')
        console.log(sensorLabels)

        //TESTING
        // sensorLabels.forEach( p =>{
        //     makeNewSensor(p);
        // })
        ////

        const headSensors = d3.select('#sensor-alias')
            .append('thead')
            .append('tr');

        headSensors.append('th').attr('scope',"col").html('Sensor ID');
        headSensors.append('th').attr('scope',"col").html('Alias');
        headSensors.append('th').attr('scope',"col").html('Sampling Period Setting');
        headSensors.append('th').attr('scope',"col").html('Battery');
        headSensors.append('th').attr('scope',"col").html('Signal Quality');
        headSensors.append('th').attr('scope',"col").html('TimeStamp');
        headSensors.append('th').attr('scope',"col").html('Is Expected?');

        const trsSensors = d3.select('#sensor-alias').append('tbody')
            .selectAll(null)
            .data(data)
            .join('tr')
             .attr('class', "series");

        const trsMeasurements = d3.select('#sensor-alias')
                .selectAll(null)
                .data(dataMeasurements)
                .join('tr')
                 .attr('class', "measurements")
                 .style('border','0');

        trsSensors.append('td')
            .html(function (d) { return d[0]; })
            .style('text-align','center')
            .style('vertical-align','middle')
        
        aliasGrp = trsSensors.append('td').style('text-align','center')
        aliasGrp.append('input')
            .attr('type','text')
            .attr('class','form-control')
            .style('display','inline-block')
            .style('max-width', () =>{
                return (window.innerWidth < 1024) ? '100%':'70%'
            })
            .style('vertical-align','middle')
            .style('margin-right','1em')
            .attr('id', d => { return "sensor"+d[0]; })
            .attr('placeholder','Add name here e.g. Kitchen')
            .attr('value', d =>{
                ret = ''
                sensorLabels.forEach( l=> {
                    if( l.sensor == d[0]){ ret = (l.label); }
                })
                return ret;
            }).on('input change', (e,d) =>{
                d3.select("#submit"+d[0]).html('Save')
                d3.select("#submit"+d[0]).classed('disabled',false)
                d3.select("#submit"+d[0]).classed('active',true)            
            })

        aliasGrp.append('button')
            .html('Save')
            .attr('id', d =>{ return 'submit'+d[0] } )
            .attr('type','submit')
            .attr('class','btn btn-sm disabled')
            .on('click', async function(e,d) {
                ret = '';
                sensorLabels.forEach( l => {
                    if( l.sensor == d[0]){ ret = (l.id); }
                })
   
                label = d3.select("#sensor"+d[0]).node().value
                editValues = {'label': label };

                result = await d3.json(`/sensors/${ret}`, {
                    method: 'POST', 
                    headers: { "Content-Type": "application/json; charset=UTF-8" },
                    'body': JSON.stringify(editValues)
                });

                if( result.changes > 0 ){
                    d3.select("#submit"+d[0]).html('Saved ✔')
                    // d3.select("#submit"+d[0]).classed('disabled',true)
                }else{
                    d3.select("#submit"+d[0]).html('Not Saved!')
                    // d3.select("#submit"+d[0]).classed('disabled',true)                    
                }
                console.log(result);
            })

        divBtnGroup = trsSensors.append('td').style('text-align','center')
            .append('div').attr('class','btn-group btn-group-sm btn-group-toggle')
            .attr('id', d =>{
                return "btnGroup"+d[0];
            })

        divBtnGroup.append('label').attr('class','btn btn-secondary')
                    .attr('value',1)
                    .html('Every second ').style('margin-right','0')
                    .classed('active', d =>{
                        ret = false;
                        sensorLabels.forEach( l => {
                            if( l.sensor == d[0]){ ret = (l.sampling_period === 1 || l.sampling_period === 3); }
                        })
                        return ret;
                    })
                    .on('click', async function (e,d) {
                        console.log(d)                    
                        // try sending it to DB first
                        ret = '';
                        sensorLabels.forEach( l => {
                            if( l.sensor == d[0]){ ret = (l.id); }
                        })
                        console.log(sensorLabels)                    

                        editValues = {'sampling_period': 1 };

                        result = await d3.json(`/sensors/${ret}`, {
                            method: 'POST', 
                            headers: { "Content-Type": "application/json; charset=UTF-8" },
                            'body': JSON.stringify(editValues)
                        });

                        if( result.changes > 0 ){
                            d3.selectAll('#btnGroup'+d[0]+' .btn').classed('active',false)
                            sel = d3.selectAll('#btnGroup'+d[0]+' .btn').nodes().filter( g => { 
                                return (d3.select(g).attr('value') == 1 )
                            })
                            d3.select(sel[0]).classed('active',true)
                        }else{
                            console.log(result);
                        }
                        console.log(result);
                    })

        divBtnGroup.append('label').attr('class','btn btn-secondary ')
                    .html('Every 30 seconds ')
                    .style('margin-right','0')
                    .attr('value',30)
                    .classed('active', d =>{
                        ret = false;
                        sensorLabels.forEach( l=> {
                            if( l.sensor == d[0]){ ret = (l.sampling_period === 30); }
                        })
                        return ret;
                    })
                    .on('click', async function (e,d) {
                        console.log(d)                    
                        // try sending it to DB first
                        ret = '';
                        sensorLabels.forEach( l => {
                            if( l.sensor == d[0]){ 
                                ret = (l.id); 
                            }
                        })

                        editValues = {'sampling_period': 30 };

                        result = await d3.json(`/sensors/${ret}`, {
                            method: 'POST', 
                            headers: { "Content-Type": "application/json; charset=UTF-8" },
                            'body': JSON.stringify(editValues)
                        });

                        if( result.changes > 0 ){
                            d3.selectAll('#btnGroup'+d[0]+' .btn').classed('active',false)
                            sel = d3.selectAll('#btnGroup'+d[0]+' .btn').nodes().filter( g => { 
                                return (d3.select(g).attr('value') == 30 )
                            })
                            d3.select(sel[0]).classed('active',true)
                        }else{
                            console.log(result);
                        }
                        console.log(result);
                    })

        trsSensors.append('td')
            .html(function (d) { 
                let ret = -1 +" ";
                d[1].forEach( p=>{
                    if(p.measurement === 'battery'){
                        ret =  p.value + " ";
                    }
                }); 
                return ret;
             })
            .style('color', d =>{
                val = -1 ;
                d[1].forEach( p =>{
                    if(p.measurement === 'battery'){
                        val =  p.value;
                    }
                });
                 if( (val) === 1) { return 'green' }
                if( (val) < 500  ){
                    return 'darkred'
                }else if( (val) < 600){
                    return 'orange'
                }else {
                    return 'green'
                }
            }).style('text-align','center')
            .style('vertical-align','middle')
            .append('label')    
            .style('background', d =>{
                val = -1;
                d[1].forEach( p=>{
                    if(p.measurement === 'battery'){
                        val =  p.value;
                    }
                }); 
                if( (val) === 1) { return 'green' }
                if( (val) < 500  ){
                    return 'darkred'
                }else if( (val) < 600){
                    return 'orange'
                }else {
                    return 'green'
                }
            }).style("border-radius","100% 100%")
            .style("width", '5px')
            .style("height", '5px')
            .style("padding",'6px')
            .style('text-align','center')
            .style('vertical-align','middle')

        trsSensors.append('td')
            .html(function (d) { 
                let ret = -100 +" ";
                let latest = 0;
                d[1].forEach( p=>{
                    if(p.measurement === 'rssi'){
                        ret =  p.value + OFFSETDB + " ";
                        latest = p.latest
                    }
                });
                smp = 0;
                d[1].forEach( p =>{
                    if(p.measurement === 'sampling_period'){
                        smp =  +p.value;
                    }
                }); 

                // if( (luxon.DateTime.now()).diff(latest,"seconds").as('seconds') > 2*smp ){
                if( d[1][0].age.length('seconds') > 2*smp ) {
                    return 'offline '
                }else {
                    return ret;
                }
             })
            .style('text-align','center')
            .style('vertical-align','middle')
            .style('color', d =>{
                val = -100;
                latest = 0
                d[1].forEach( p =>{
                    if(p.measurement === 'rssi'){
                        val =  p.value;
                        latest = p.latest;
                    }
                }); 
                smp = 0;
                d[1].forEach( p =>{
                    if(p.measurement === 'sampling_period'){
                        smp =  +p.value;
                    }
                }); 
                if( (luxon.DateTime.now()).diff(latest,"seconds").as('seconds') > 2*smp ){
                    return 'darkred'
                }else if( (val + OFFSETDB) < 10 ){
                    return 'darkred'
                }else if( (val + OFFSETDB) < 30){
                    return 'orange'
                }else {
                    return 'green'
                }
            }).append('label')    
            .style('background', d =>{
                val = -100;
                latest = 0
                d[1].forEach( p=>{
                    if(p.measurement === 'rssi'){
                        val =  p.value;
                        latest = p.latest;
                    }
                }); 
                
                smp = 0;
                d[1].forEach( p =>{
                    if(p.measurement === 'sampling_period'){
                        smp =  +p.value;
                    }
                }); 
                if( (luxon.DateTime.now()).diff(latest,"seconds").as('seconds') > 2*smp ){
                    return 'darkred'
                }else if( (val + OFFSETDB) < 10 ){
                    return 'darkred'
                }else if( (val + OFFSETDB) < 30){
                    return 'orange'
                }else {
                    return 'green'
                }
            }).style("border-radius","100% 100%")
            .style("width", '5px')
            .style("height", '5px')
            .style("padding",'6px')
            .style('text-align','center')
            .style('vertical-align','middle')

        trsSensors.append('td')
            .html(function (d) { 
                if( d[1][0].age.length('milliseconds') > 60*60*1000  ){
                    return "(more than an hour ago)";
                }else{
                    return '('+humanizeDuration(d[1][0].age.length('milliseconds'))+")" ;
                }
            }).style('text-align','center')
            .style('vertical-align','middle')
            
        trsSensors.append('td')
            .style('text-align','center')
            .style('vertical-align','middle')
                .append('div').attr('class','form-switch')
                .append('input')
                .attr('class','form-check-input isexpected')
                .attr('type','checkbox')
                .property('checked', d => {
                    ret = false;
                    sensorLabels.forEach( l => {
                        if( l.sensor == d[0]){ 
                            ret = l.expected; 
                        }
                    })
                    return Boolean(ret);
                })

        d3.selectAll('.isexpected').on('change', async (p,l) =>{
            console.log(l) // l is data
            console.log(p.target.checked)

            editValues = {'expected': +(p.target.checked) };

            // try sending it to DB first
            ret = '';
            sensorLabels.forEach( i => {
                if( i.sensor == l[0]){ 
                    ret = (i.id); 
                }
            })
            
            // Send to DB
            result = await d3.json(`/sensors/${ret}`, {
                method: 'POST', 
                headers: { "Content-Type": "application/json; charset=UTF-8" },
                'body': JSON.stringify(editValues)
            });

            console.log(result)
        })

        trsMeasurements.append('td') // empty
        trsMeasurements.append('td').html(d => { return d.measurement; })
        trsMeasurements.append('td').html(d => { return d.value.toFixed(2); })

        trsMeasurements.selectAll('td').style('border',0)
        
        // Place the measurements under the correct row
        d3.selectAll("tr.series").nodes().forEach( (d) => {
            ent = trsMeasurements.filter( f => {
                return (f.sensor_id == d.__data__[0])
            })
            ent.nodes().forEach( (h) =>{
                insertAfter(d,h);
            } )
        });

        //https://www.w3docs.com/snippets/javascript/how-to-insert-an-element-after-another-element-in-javascript.html
        function insertAfter(referenceNode, newNode) {
            referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
        }

        d3.select('#spinner').style('display', 'none');

    });

    // Periodical refresh if FLAG is down
    function refreshData() {
        // window.location.reload();
    }

    startTimer();

    function startTimer() { 
        // window.setTimeout returns an Id that can be used to start and stop a timer
        timeoutId = window.setTimeout(refreshData, timeOfInactivity)
    }

    resetTimeOfInactivity = function (){
    
        window.clearTimeout(timeoutId)
        startTimer();

        timeOfInactivity = 5*60*1000;
    }

    // async function makeNewSensor(p){
    //     let eventSanitized = {
    //         'id':p.id,
    //         'sensor':p.sensor,
    //         'label': p.label,
    //         'sampling_period':p.sampling_period,
    //         'expected': p.expected,
    //     }

    //     try{
    //         d3.select('#spinner').style('display','block');

    //         let result = await d3.json('/sensors', {
    //             method: 'PUT', 
    //             headers: { "Content-Type": "application/json; charset=UTF-8" },
    //             'body': JSON.stringify(eventSanitized)
    //         });

    //         console.log(result)
            
    //         d3.select('#spinner').style('display','none')
    //     }catch(e){
    //         console.log(e);
    //         d3.select('#spinner').style('display','none');
    //     }
    // }

});