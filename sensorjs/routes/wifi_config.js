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
/*eslint no-control-regex: 0 */
const fs = require('fs');

// from https://stackoverflow.com/a/14638191/6872193
function formatDate(date, format, utc) {
    var MMMM = ["\x00", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    var MMM = ["\x01", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var dddd = ["\x02", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    var ddd = ["\x03", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    function ii(i, len) {
        var s = i + "";
        len = len || 2;
        while (s.length < len) s = "0" + s;
        return s;
    }

    var y = utc ? date.getUTCFullYear() : date.getFullYear();
    format = format.replace(/(^|[^\\])yyyy+/g, "$1" + y);
    format = format.replace(/(^|[^\\])yy/g, "$1" + y.toString().substr(2, 2));
    format = format.replace(/(^|[^\\])y/g, "$1" + y);

    var M = (utc ? date.getUTCMonth() : date.getMonth()) + 1;
    format = format.replace(/(^|[^\\])MMMM+/g, "$1" + MMMM[0]);
    format = format.replace(/(^|[^\\])MMM/g, "$1" + MMM[0]);
    format = format.replace(/(^|[^\\])MM/g, "$1" + ii(M));
    format = format.replace(/(^|[^\\])M/g, "$1" + M);

    var d = utc ? date.getUTCDate() : date.getDate();
    format = format.replace(/(^|[^\\])dddd+/g, "$1" + dddd[0]);
    format = format.replace(/(^|[^\\])ddd/g, "$1" + ddd[0]);
    format = format.replace(/(^|[^\\])dd/g, "$1" + ii(d));
    format = format.replace(/(^|[^\\])d/g, "$1" + d);

    var H = utc ? date.getUTCHours() : date.getHours();
    format = format.replace(/(^|[^\\])HH+/g, "$1" + ii(H));
    format = format.replace(/(^|[^\\])H/g, "$1" + H);

    var h = H > 12 ? H - 12 : H == 0 ? 12 : H;
    format = format.replace(/(^|[^\\])hh+/g, "$1" + ii(h));
    format = format.replace(/(^|[^\\])h/g, "$1" + h);

    var m = utc ? date.getUTCMinutes() : date.getMinutes();
    format = format.replace(/(^|[^\\])mm+/g, "$1" + ii(m));
    format = format.replace(/(^|[^\\])m/g, "$1" + m);

    var s = utc ? date.getUTCSeconds() : date.getSeconds();
    format = format.replace(/(^|[^\\])ss+/g, "$1" + ii(s));
    format = format.replace(/(^|[^\\])s/g, "$1" + s);

    var f = utc ? date.getUTCMilliseconds() : date.getMilliseconds();
    format = format.replace(/(^|[^\\])fff+/g, "$1" + ii(f, 3));
    f = Math.round(f / 10);
    format = format.replace(/(^|[^\\])ff/g, "$1" + ii(f));
    f = Math.round(f / 10);
    format = format.replace(/(^|[^\\])f/g, "$1" + f);

    var T = H < 12 ? "AM" : "PM";
    format = format.replace(/(^|[^\\])TT+/g, "$1" + T);
    format = format.replace(/(^|[^\\])T/g, "$1" + T.charAt(0));

    var t = T.toLowerCase();
    format = format.replace(/(^|[^\\])tt+/g, "$1" + t);
    format = format.replace(/(^|[^\\])t/g, "$1" + t.charAt(0));

    var tz = -date.getTimezoneOffset();
    var K = utc || !tz ? "Z" : tz > 0 ? "+" : "-";
    if (!utc) {
        tz = Math.abs(tz);
        var tzHrs = Math.floor(tz / 60);
        var tzMin = tz % 60;
        K += ii(tzHrs) + ":" + ii(tzMin);
    }
    format = format.replace(/(^|[^\\])K/g, "$1" + K);

    var day = (utc ? date.getUTCDay() : date.getDay()) + 1;
    format = format.replace(new RegExp(dddd[0], "g"), dddd[day]);
    format = format.replace(new RegExp(ddd[0], "g"), ddd[day]);

    format = format.replace(new RegExp(MMMM[0], "g"), MMMM[M]);
    format = format.replace(new RegExp(MMM[0], "g"), MMM[M]);

    format = format.replace(/\\(.)/g, "$1");

    return format;
}

// let re = new RegExp('\\w+', 'gs');
const re = new RegExp('network={([^}]+)}', 'gs');
const ssidRe = new RegExp('ssid="([^\n]+)"\n', 's');
const pskRe = new RegExp('psk="([^\n]+)"\n', 's');
const idRe = new RegExp('id_str="([^\n]+)"\n', 's');

const header = `ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev
update_config=1
country=GB
`;

function updateNetworkInfo (params) {
    const {
        newSsid, newPass, cb
        } = params;
    const configFile = '/etc/wpa_supplicant/wpa_supplicant.conf';
    //const outfile = 'test.conf';
    const outfile = configFile;
    fs.readFile(configFile, 'utf8', function (err, data) {
        //console.log('readFile err:', err);
        if (err) {            
            if (cb !== undefined) {
                cb(err);
                return;
            }
        }
        let text = data.toString();
        //console.log(text);
        // backup file
        const backupFile = `wpa_supplicant_backup_${formatDate(new Date(),'yyyyMMdd_hhmmss')}.conf`;
        fs.writeFile(backupFile, text, 'ascii', function (err) {
            // console.log('done');
            if (cb !== undefined) {
                cb({
                    'back up error': err
                });
                return;
            }
        });

        //let result = [...text.matchAll(re)];
        let result = [];
        let match;

        while ((match = re.exec(text)) !== null) {
            result.push(['', match[0]]);
          //console.log(`Found ${match[0]} start=${match.index} end=${regexp.lastIndex}.`);
          // expected output: "Found football start=6 end=14."
          // expected output: "Found foosball start=16 end=24."
        }        

        let networkInfo = result.map(function(element) {
            const networkInfo = element[1];
            const ssid = networkInfo.match(ssidRe)[1];
            const password = networkInfo.match(pskRe)[1];
            const idString = networkInfo.match(idRe)[1];

            return {
                'ssid': ssid,
                'password': password,
                'idString': idString
            };
        }); 

        // console.log(networkInfo);

        const index = networkInfo.map(function(item) { return item.ssid; }).indexOf(newSsid);
        if (index >= 0) {
            networkInfo[index].password = newPass;
        } else {
            networkInfo.push({
                'ssid': newSsid,
                'password': newPass,
                'idString': newSsid
            });
        }
        // console.log('..and then:');
        // console.log(networkInfo);

        const networksText = networkInfo.map(function (n) {
            return `network={
                ssid="${n.ssid}"
                psk="${n.password}"
                id_str="${n.idString}"
            }`;
        });

        const output = `${header}\n${networksText.join("\n\n")}\n\n`;
        // console.log(output);
        fs.writeFile(outfile, output, 'ascii', function (err) {
            // console.log('done');
            if (cb !== undefined) {
                cb(err);
                return;
            }
        });
    });
}

// updateNetworkInfo({
//     newSsid: 'test',
//     newPass: 'some_other_pass',
//     cb: function () {console.log(done);}
// });

exports.updateNetworkInfo = updateNetworkInfo;
