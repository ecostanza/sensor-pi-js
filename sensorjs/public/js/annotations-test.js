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

document.addEventListener("DOMContentLoaded", async function() { 

    // test creating an annotation
    const annotation_data = {
        start: new Date(),
        duration_seconds: 60*60, // 60 minutes
        type: 'oven',
        description: 'baking bread',      
        // consumption: Float?
        flexibility: 'generally any time between 6:30 and 9',
        'sensor': '100', 
        'measurement': 'electricity_consumption'
    };

    let result  = await d3.json('/annotations', {
        method: 'PUT', 
        headers: { "Content-Type": "application/json; charset=UTF-8" },
        'body': JSON.stringify(annotation_data)
    });
    
    console.log('result', result);

    // get all annotations
    result = await d3.json('/annotations');
    console.log('get result', result);

    let id = result[0]['id'];

    // test editing an annotation
    const edit_data = {'description': 'something else'};
    result  = await d3.json(`/annotations/${id}`, {
        method: 'POST', 
        headers: { "Content-Type": "application/json; charset=UTF-8" },
        'body': JSON.stringify(edit_data)
    });

    // get all annotations
    result = await d3.json('/annotations');
    console.log('get result', result);

    // test deleting an annotation
    result  = await d3.json(`/annotations/${id}`, {
        method: 'DELETE'
    });
    console.log('delete result', result);

    // get all annotations
    result = await d3.json('/annotations');
    console.log('get result', result);

    // -----------------------------------------------

    // test creating an annotation
    const sensor_data = {
        sensor: '100', 
        label: 'first sensor',      
        // consumption: Float?
        sampling_period: '30'
    };

    let sensor_result  = await d3.json('/sensors', {
        method: 'PUT', 
        headers: { "Content-Type": "application/json; charset=UTF-8" },
        'body': JSON.stringify(sensor_data)
    });
    
    console.log('sensor_result', sensor_result);

    // get all sensors
    result = await d3.json('/sensors');
    console.log('get sensors result', result);

    let dupe_sensor_result  = await d3.json('/sensors', {
        method: 'PUT', 
        headers: { "Content-Type": "application/json; charset=UTF-8" },
        'body': JSON.stringify(sensor_data)
    });
    
    console.log('dupe_sensor_result', dupe_sensor_result);

    // get all sensors
    result = await d3.json('/sensors');
    console.log('get sensors result', result);


    let sensor_id = result[0]['id'];

    // test editing a sensor
    const edit_sensor_data = {label: 'something else'};
    result  = await d3.json(`/sensors/${sensor_id}`, {
        method: 'POST', 
        headers: { "Content-Type": "application/json; charset=UTF-8" },
        'body': JSON.stringify(edit_sensor_data)
    });
    console.log('post sensors result', result);

    // get all sensors
    result = await d3.json('/sensors');
    console.log('get sensors result', result);

    // test deleting an annotation
    result  = await d3.json(`/sensors/${sensor_id}`, {
        method: 'DELETE'
    });
    console.log('delete result', result);

    // get all sensors
    result = await d3.json('/sensors');
    console.log('get result', result);

});