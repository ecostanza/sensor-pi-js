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
// const { PrismaClient } = require('@prisma/client');
// const prisma = new PrismaClient()
const Database = require('better-sqlite3');
const luxon = require('luxon');

const { 
    thermostat_day_profile_fields, 
    thermostat_slot_fields, 
    thermostat_day_profile_activation_fields, 
    thermostat_temperature_boost_fields,
    get_current_day_profile,
    get_latest_temperature_boost
} = require('./thermostat_utils');

try {
    const now = Date.now();

    // home day
    // create a day profile
    let query = `
        INSERT INTO thermostat_day_profiles 
        (name, description, default_profile, createdAt, updatedAt) 
        VALUES ('home day', 'home all day', false, ${now}, ${now});`
    
    // let db = new Database('./db.sqlite3', { verbose: console.log });
    let db = new Database('./db.sqlite3');
    let statement = db.prepare(query);
    let result = statement.run();
    console.log('result:', result);
    
    // 3pm day
    query = `
        INSERT INTO thermostat_day_profiles 
        (name, description, default_profile, createdAt, updatedAt) 
        VALUES ('3pm day', 'back home at 3', false, ${now}, ${now});`
    
    statement = db.prepare(query);
    result = statement.run();
    console.log('result:', result);

    // 6pm day
    query = `
        INSERT INTO thermostat_day_profiles 
        (name, description, default_profile, createdAt, updatedAt) 
        VALUES ('6pm day', 'back home at 6', true, ${now}, ${now});`
    
    statement = db.prepare(query);
    result = statement.run();
    console.log('result:', result);

    // 8pm day
    query = `
        INSERT INTO thermostat_day_profiles 
        (name, description, default_profile, createdAt, updatedAt) 
        VALUES ('8pm day', 'back home at 8', false, ${now}, ${now});`
    
    statement = db.prepare(query);
    result = statement.run();
    console.log('result:', result);

    // off day
    query = `
        INSERT INTO thermostat_day_profiles 
        (name, description, default_profile, createdAt, updatedAt) 
        VALUES ('off day', 'completely off', false, ${now}, ${now});`
    
    statement = db.prepare(query);
    result = statement.run();
    console.log('result:', result);

    const day_profile_on_time = {
        'home day': {'hour': 8, 'minute': 45},
        '3pm day': {'hour': 15, 'minute': 0},
        '6pm day': {'hour': 18, 'minute': 0},
        '8pm day': {'hour': 20, 'minute': 0}
    };
    const off_temperature = 16.0;
    const on_temperature = 19.0;

    query = `
        SELECT id FROM thermostat_day_profiles WHERE name = 'off day';`
    
    statement = db.prepare(query);
    result = statement.get();
    console.log('result:', result);
    const off_day_id = result.id;
    
    for (let i = 0; i < 24 * 4; i += 1) {
        let hour = i / 4;
        let minute = i % 4 * 15;
        query = `
            INSERT INTO thermostat_slots 
            (hour, minute, temperature, thermostat_day_profiles_id, createdAt, updatedAt) 
            VALUES (${hour}, ${minute}, ${off_temperature}, ${off_day_id}, ${now}, ${now});`
        
        statement = db.prepare(query);
        result = statement.run();
        console.log(`${i}: off day, ${hour}, ${minute}, result:`, result);
    }

    // iterate over the keys of the day_profile_on_time object    
    for (const [dpn, on_time_obj] of Object.entries(day_profile_on_time)) {
        on_time = on_time_obj['hour'] * 4 + on_time_obj['minute'] / 15;
        query = `
            SELECT id FROM thermostat_day_profiles WHERE name = '${dpn}';`
        
        statement = db.prepare(query);
        result = statement.get();
        console.log('result:', result);

        const day_profile_id = result.id;

        let i = 0;
        // wakeup time 5:45
        const getup_time = 5*4 + 3;
        // out of home time 8:30
        const out_time = 8*4 + 2;
        // sleep time 22:30
        const sleep_time = 22*4 + 2;
        for (i = 0; i < getup_time; i += 1) {
            let hour = Math.floor(i / 4);
            let minute = (i % 4) * 15;
            query = `
                INSERT INTO thermostat_slots 
                (hour, minute, temperature, thermostat_day_profiles_id, createdAt, updatedAt) 
                VALUES (${hour}, ${minute}, ${off_temperature}, ${day_profile_id}, ${now}, ${now});`
            
            statement = db.prepare(query);
            result = statement.run();
            console.log(`${i}: ${dpn}, ${hour}, ${minute}, result:`, result);
        }
        for (i = getup_time; i < out_time; i += 1) {
            let hour = Math.floor(i / 4);
            let minute = (i % 4) * 15;
            query = `
                INSERT INTO thermostat_slots 
                (hour, minute, temperature, thermostat_day_profiles_id, createdAt, updatedAt) 
                VALUES (${hour}, ${minute}, ${on_temperature}, ${day_profile_id}, ${now}, ${now});`
            
            statement = db.prepare(query);
            result = statement.run();
            console.log(`${i}: ${dpn}, ${hour}, ${minute}, result:`, result);
        }
        for (i = out_time; i < on_time; i += 1) {
            let hour = Math.floor(i / 4);
            let minute = (i % 4) * 15;
            query = `
                INSERT INTO thermostat_slots 
                (hour, minute, temperature, thermostat_day_profiles_id, createdAt, updatedAt) 
                VALUES (${hour}, ${minute}, ${off_temperature}, ${day_profile_id}, ${now}, ${now});`
            
            statement = db.prepare(query);
            result = statement.run();
            console.log(`${i}: ${dpn}, ${hour}, ${minute}, result:`, result);
        }
        for (i = on_time; i < sleep_time; i += 1) {
            let hour = Math.floor(i / 4);
            let minute = (i % 4) * 15;
            query = `
                INSERT INTO thermostat_slots 
                (hour, minute, temperature, thermostat_day_profiles_id, createdAt, updatedAt) 
                VALUES (${hour}, ${minute}, ${on_temperature}, ${day_profile_id}, ${now}, ${now});`
            
            statement = db.prepare(query);
            result = statement.run();
            console.log(`${i}: ${dpn}, ${hour}, ${minute}, result:`, result);
        }
        for (i = sleep_time; i < 24*4; i += 1) {
            let hour = Math.floor(i / 4);
            let minute = (i % 4) * 15;
            query = `
                INSERT INTO thermostat_slots 
                (hour, minute, temperature, thermostat_day_profiles_id, createdAt, updatedAt) 
                VALUES (${hour}, ${minute}, ${on_temperature}, ${day_profile_id}, ${now}, ${now});`
            
            statement = db.prepare(query);
            result = statement.run();
            console.log(`${i}: ${dpn}, ${hour}, ${minute}, result:`, result);
        }
    }

    
} catch (error) {
    console.log('error:', error);
}
