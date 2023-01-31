// const db = require('better-sqlite3')('./db.sqlite3');
const Database = require('better-sqlite3');
const db = new Database('./db.sqlite3', { verbose: console.log });
// import Database from 'better-sqlite3';
// const db = new Database('./sqlite3.db', { verbose: console.log });

try {
    const annotations_q = `
    CREATE TABLE annotations ( 
    id  INTEGER PRIMARY KEY AUTOINCREMENT,
    start INTEGER   NOT NULL,
    duration_seconds INTEGER   NOT NULL,
    
    type TEXT   NOT NULL,
    description TEXT,
    
    consumption REAL,
    
    flexibility TEXT,
    
    measurement TEXT   NOT NULL,
    sensor TEXT   NOT NULL,
    
    createdAt INTEGER   NOT NULL,
    updatedAt INTEGER   NOT NULL
    )`;
    console.log('query:', annotations_q);
    // console.log('query:', q.replaceAll(/\n/g, ''));
    // console.log('query:', q);

    const create_annotations = db.prepare(annotations_q);
    
    const annotations_result = create_annotations.run();
    console.log('result:', annotations_result);

    // create sensors table
    const sensors_q = `
    CREATE TABLE sensors ( 
    id  INTEGER PRIMARY KEY AUTOINCREMENT,

    sensor TEXT   NOT NULL UNIQUE,

    label TEXT   NOT NULL,
    sampling_period INTEGER DEFAULT 1 NOT NULL,
    
    createdAt INTEGER   NOT NULL,
    updatedAt INTEGER   NOT NULL
    )`;
    console.log('query:', sensors_q);
    // console.log('query:', q.replaceAll(/\n/g, ''));
    // console.log('query:', q);

    const create_sensors = db.prepare(sensors_q);
    
    const sensors_result = create_sensors.run();
    console.log('result:', sensors_result);

} catch (error) {
    console.log('error:', error);
}

// db.close();
