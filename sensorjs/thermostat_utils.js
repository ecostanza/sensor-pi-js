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

// const Database = require('better-sqlite3');

const thermostat_day_profile_fields = [
    {'name': 'id', 'required': false, 'auto': true},

    {'name': 'name', 'required': true, 'auto': false},
    {'name': 'description', 'required': false, 'auto': false},
    {'name': 'default_profile', 'required': true, 'auto': false},
    
    {'name': 'createdAt', 'required': false, 'auto': true},
    {'name': 'updatedAt', 'required': false, 'auto': true}
];

const thermostat_slot_fields = [
    {'name': 'id', 'required': false, 'auto': true},

    {'name': 'hour', 'required': true, 'auto': false},
    {'name': 'minute', 'required': true, 'auto': false},

    {'name': 'temperature', 'required': true, 'auto': false},

    {'name': 'thermostat_day_profiles_id', 'required': true, 'auto': false},
    
    {'name': 'createdAt', 'required': false, 'auto': true},
    {'name': 'updatedAt', 'required': false, 'auto': true}
];

const thermostat_day_profile_activation_fields = [
    {'name': 'id', 'required': false, 'auto': true},

    {'name': 'thermostat_day_profiles_id', 'required': true, 'auto': false},
    
    {'name': 'createdAt', 'required': false, 'auto': true},
    {'name': 'updatedAt', 'required': false, 'auto': true}
];

const thermostat_temperature_boost_fields = [
    {'name': 'id', 'required': false, 'auto': true},

    {'name': 'temperature', 'required': true, 'auto': false},
    {'name': 'duration_seconds', 'required': true, 'auto': false},
    {'name': 'start', 'required': true, 'auto': false},
    
    {'name': 'createdAt', 'required': false, 'auto': true},
    {'name': 'updatedAt', 'required': false, 'auto': true}
];

const get_current_day_profile = function (db) {
        // select the most recent day_profile_activation
        // const query = `SELECT ${day_profile_activation_columns.join()} from thermostat_day_profile_activations ORDER BY createdAt DESC LIMIT 1;`;

        const day_profile_columns = thermostat_day_profile_fields.map(f => f['name']);

        // setup a query to select the thermostat_day_profile corresponding to the most recent thermostat_day_profile_activation
        const query = `SELECT ${day_profile_columns.join()} from thermostat_day_profiles WHERE id in (
        SELECT thermostat_day_profiles_id from thermostat_day_profiles_activations ORDER BY createdAt DESC LIMIT 1);`;

        // console.log('query:', query);
        const select = db.prepare(query);
        // console.log('prepare returned:', select);
        const day_profile = select.get();
        return day_profile;
}

const get_latest_temperature_boost = function (db) {
    const temperature_boost_columns = thermostat_temperature_boost_fields.map(f => f['name']);

    // select the most recent temperature_boost
    const query = `SELECT ${temperature_boost_columns.join()} from thermostat_temperature_boosts ORDER BY start DESC LIMIT 1;`;

    // console.log('query:', query);
    const select = db.prepare(query);
    // console.log('prepare returned:', select);
    const temperature_boost = select.get();
    return temperature_boost;
}

module.exports = {
    thermostat_day_profile_fields,
    thermostat_slot_fields,
    thermostat_day_profile_activation_fields,
    thermostat_temperature_boost_fields,
    get_current_day_profile,
    get_latest_temperature_boost
};
