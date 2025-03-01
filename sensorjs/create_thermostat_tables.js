// const db = require('better-sqlite3')('./db.sqlite3');
const Database = require('better-sqlite3');
console.log('connecting to db..');
const db = new Database('./db.sqlite3', { verbose: console.log });
console.log('..done');
// import Database from 'better-sqlite3';
// const db = new Database('./sqlite3.db', { verbose: console.log });

function run_query(db, q) {
    try {
        console.log('query:', q);
        const create = db.prepare(q);
        
        const result = create.run();
        console.log('result:', result);
    } catch (error) {
        console.log('error:', error);
        throw error;
    }
}

try {
    const pragma_result = db.pragma("foreign_keys = 1");
    console.log('pragma_result:', pragma_result);
    console.log('foreign_keys:', db.pragma("foreign_keys"), { simple: true }); 

    const day_profiles_q = `
    CREATE TABLE thermostat_day_profiles ( 
    id  INTEGER PRIMARY KEY AUTOINCREMENT,
    
    name TEXT   NOT NULL,
    description TEXT,
    default_profile BOOLEAN DEFAULT FALSE NOT NULL,

    createdAt INTEGER   NOT NULL,
    updatedAt INTEGER   NOT NULL
    )`;
    run_query(db, day_profiles_q);
    
    const slots_q = `
    CREATE TABLE thermostat_slots ( 
    id  INTEGER PRIMARY KEY AUTOINCREMENT,
    hour INTEGER   NOT NULL,
    minute INTEGER   NOT NULL,
    temperature REAL   NOT NULL,
    
    thermostat_day_profiles_id INTEGER NOT NULL,

    createdAt INTEGER   NOT NULL,
    updatedAt INTEGER   NOT NULL
    )`;
    run_query(db, slots_q);

    const day_profile_activations_q = `
    CREATE TABLE thermostat_day_profiles_activations ( 
    id  INTEGER PRIMARY KEY AUTOINCREMENT,
    
    thermostat_day_profiles_id INTEGER   NOT NULL,

    createdAt INTEGER   NOT NULL,
    updatedAt INTEGER   NOT NULL
    )`;
    run_query(db, day_profile_activations_q);

    const temperature_boosts_q = `
    CREATE TABLE thermostat_temperature_boosts (
    id  INTEGER PRIMARY KEY AUTOINCREMENT,

    temperature REAL   NOT NULL,
    duration_seconds INTEGER   NOT NULL,
    start INTEGER   NOT NULL,

    createdAt INTEGER   NOT NULL,
    updatedAt INTEGER   NOT NULL
    )`;
    run_query(db, temperature_boosts_q);

} catch (error) {
    console.log('error:', error);
}

// db.close();
