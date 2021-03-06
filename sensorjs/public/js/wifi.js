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

document.addEventListener("DOMContentLoaded",  function() { 


    function checkPassword(pass){
        if( pass.length < 8 || pass.length > 63)
        {
            return false;
        }else{
            return true;
        }
    }

    d3.select('#submitBtn').on('click', async function () {
        const ssid = d3.select('#ssid').node().value;
        const password = d3.select('#networkPassword').node().value;
        console.log(ssid, password);

        if(checkPassword(password)){        

            try {
                let result = await d3.json('/wificonfig/', {
                    method: 'POST', 
                    headers: { "Content-Type": "application/json" }, 
                    body: JSON.stringify({
                        'ssid': ssid, 
                        'networkPassword': password
                    })
                })

                d3.select('#infoBox').style('color','green').style('font-style','italic').style('margin-top','1em').html('Submission successful!')
                console.log('post response:', result);
            }catch(e){
                console.log(e);
                d3.select('#infoBox').style('color','indianred').style('font-style','italic').style('margin-top','1em').html(e)
            }
        }else{
            d3.select('#infoBox').style('color','indianred').style('font-style','italic').style('margin-top','1em').html('Password should be 8-63 characters long');            
        }

    });


    d3.select('#rebootBtn').on('click',async function () {
        try {
            d3.select('#infoBox').style('font-style','italic').style('margin-top','1em').style('color','black').html('Restarting..')
            d3.select('#shutdownBtn').classed('disabled', true)
            d3.select('#submitBtn').classed('disabled', true)
            let result = await d3.json('/system/', {
                method: 'POST', 
                headers: { "Content-Type": "application/json" }, 
                body: JSON.stringify({
                    'command': 'reboot', 
                })
            })

        }catch(e){
            console.log(e);
            d3.select('#infoBox').style('color','indianred').style('font-style','italic').style('margin-top','1em').html(e)
            d3.select('#shutdownBtn').classed('disabled', false)
            d3.select('#submitBtn').classed('disabled', false)
       }

    });

    d3.select('#shutdownBtn').on('click',async function () {
        try {
            d3.select('#infoBox').style('font-style','italic').style('margin-top','1em').html('Shutting down..')
            d3.select('#rebootBtn').classed('disabled', true)
            d3.select('#submitBtn').classed('disabled', true)
    
            let result = await d3.json('/system/', {
                method: 'POST', 
                headers: { "Content-Type": "application/json" }, 
                body: JSON.stringify({
                    'command': 'poweroff', 
                })
            })

        }catch(e){
            console.log(e);
            d3.select('#rebootBtn').classed('disabled', false)
            d3.select('#submitBtn').classed('disabled', false)
            // d3.select('#infoBox').style('color','indianred').style('font-style','italic').style('margin-top','1em').html(e)
        }

    });


});