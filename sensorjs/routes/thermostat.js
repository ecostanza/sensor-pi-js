/*
 * This file is part of sensor-pi-js a simple platform to collect and visualize
 * sensor data using Raspberry Pi, wireless sensor nodes and Web technology.
 * 
 * Copyright (C) 2025 Enrico Costanza e.costanza@ucl.ac.uk
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
var express = require('express');
var router = express.Router();
// const { PrismaClient } = require('@prisma/client');
// const prisma = new PrismaClient()
const Database = require('better-sqlite3');
const { 
    thermostat_day_profile_fields, 
    thermostat_slot_fields, 
    thermostat_day_profile_activation_fields, 
    thermostat_temperature_boost_fields,
    get_current_day_profile,
    get_latest_temperature_boost
} = require('../thermostat_utils');

// router.get('/thermostat-test', async function(req, res) {
//     return res.render('thermostat-test.html');
// });

router.get('/thermostat', async function(req, res) {
    return res.render('thermostat.html');
});

// setup a route to get the most recent thermostat_day_profile
router.get('/current_day_profile', async function(req, res) {
    try {
        const db = Database('./db.sqlite3');
        const day_profile = get_current_day_profile(db);
        return res.json(day_profile);
    }
    catch (error) {
        return res.json({'error': error});
    }
});

// setup a route to get the most recent temperature_boost
router.get('/latest_temperature_boost', async function(req, res) {
    try {
        const db = Database('./db.sqlite3');
        const temperature_boost = get_latest_temperature_boost(db);
        return res.json(temperature_boost);
    } catch (error) {
        return res.json({'error': error});
    }
});

// function to populate the data for temperature_boost
function populate_temperature_boost_data (req, updating) {
    let data = {};
    const relevant_fields = thermostat_temperature_boost_fields.filter(f => f['auto'] === false);
    for (const f of relevant_fields) {
        if (req.body[f['name']] !== undefined) {
            data[f['name']] = req.body[f['name']];
        } else if (f['required'] === true) {
            // raise exception if not present
            // TODO: test this!
            throw `${f['name']} expected`;
        }
    }
    if (!updating) {
        data['createdAt'] = (new Date()).getTime();
    }
    data['updatedAt'] = (new Date()).getTime();
    return data;
}

// setup a route to post a new temperature_boost
router.post('/temperature_boosts', async function(req, res) {
    try {
        let data = populate_temperature_boost_data(req);
        
        let columns = [];
        let values = [];
        for (const key in data) {
            columns.push(key);
            values.push("'" + data[key] + "'");
        }

        const query = `
        INSERT INTO thermostat_temperature_boosts 
        (${columns.join(",\n")}) 
        VALUES (${values.join(",\n")});
        `;
        // console.log('query:', query);
        const db = Database('./db.sqlite3');
        const insert = db.prepare(query);
        // console.log('prepare returned:', insert);
        const info = insert.run();
        // console.log('info:', info);

        return res.json(info);
    } catch (error) {
        return res.json({'error': error});
    }
});

// function to populate the data for thermostat_day_profile_activation
function populate_day_profile_activation_data (req, updating) {
    let data = {};
    const relevant_fields = thermostat_day_profile_activation_fields.filter(f => f['auto'] === false);
    for (const f of relevant_fields) {
        if (req.body[f['name']] !== undefined) {
            data[f['name']] = req.body[f['name']];
        } else if (f['required'] === true) {
            // raise exception if not present
            // TODO: test this!
            throw `${f['name']} expected`;
        }
    }
    if (!updating) {
        data['createdAt'] = (new Date()).getTime();
    }
    data['updatedAt'] = (new Date()).getTime();
    return data;
}

// setup a route to post a new thermostat_day_profile_activation
router.post('/day_profile_activations', async function(req, res) {
    try {
        // let data = populate_day_profile_activation_data(req);
        const day_profile_id = req.body['thermostat_day_profiles_id'] = parseInt(req.body['thermostat_day_profiles_id'], 10);

        // get the object from the db
        const db = Database('./db.sqlite3');
        const day_profile = db.prepare(`SELECT id from thermostat_day_profiles WHERE id = ${day_profile_id};`).get();
        console.log('day_profile:', day_profile['id']);

        const columns = ['thermostat_day_profiles_id', 'createdAt', 'updatedAt'];
        const values = [day_profile['id'], (new Date()).getTime(), (new Date()).getTime()];

        // "INSERT INTO thermostat_day_profiles_activations (thermostat_day_profiles_id, createdAt, updatedAt) VALUES (?, ?, ?);", 
        const query = `
        INSERT INTO thermostat_day_profiles_activations
        (${columns.join(",\n")})
        VALUES (${values.join(",\n")});
        `;
        console.log('query:', query);
        // const db = Database('./db.sqlite3');
        const insert = db.prepare(query);
        console.log('prepare returned:', insert);
        const info = insert.run();
        console.log('info:', info);
        
        return res.json(info);
    } catch (error) {
        return res.json({'error': error});
    }
});

// setup a route to get all thermostat_day_profiles from the db
router.get('/thermostat_day_profiles', async function(req, res) {
    try {
        const day_profile_columns = thermostat_day_profile_fields.map(f => f['name']);
        const query = `SELECT ${day_profile_columns.join()} from thermostat_day_profiles;`;
        // console.log('query:', query);
        const db = Database('./db.sqlite3');
        const select = db.prepare(query);
        // console.log('prepare returned:', select);
        const day_profiles = select.all();
        // console.log('annotations:', annotations);
        return res.json(day_profiles);
    } catch (error) {
        return res.json({'error': error});
    }
});

// setup a route to get all thermostat_slots from the db for a given thermostat_day_profile
router.get('/thermostat_slots', async function(req, res) {
    try {
        const day_profile_id = parseInt(req.query['day_profile_id'], 10);

        const slot_columns = thermostat_slot_fields.map(f => f['name']);
        const query = `SELECT ${slot_columns.join()} from thermostat_slots WHERE thermostat_day_profile_id = ${day_profile_id};`;
        // console.log('query:', query);
        const db = Database('./db.sqlite3');
        const select = db.prepare(query);
        // console.log('prepare returned:', select);
        const slots = select.all();
        // console.log('annotations:', annotations);
        return res.json(slots);
    } catch (error) {
        return res.json({'error': error});
    }
});



module.exports = router;
