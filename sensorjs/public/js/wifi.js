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

    d3.select('#submitBtn').on('click', function () {
        const ssid = d3.select('#ssid').node().value;
        const password = d3.select('#networkPassword').node().value;
        console.log(ssid, password);

        d3.json('/wificonfig/', {
            method: 'POST', 
            headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify({
                'ssid': ssid, 
                'networkPassword': password
            })
        }).then(function (data) {
            console.log('post response:', data);
        })

    });

});