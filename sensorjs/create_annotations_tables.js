// const db = require('better-sqlite3')('./db.sqlite3');
const Database = require('better-sqlite3');
const db = new Database('./db.sqlite3', { verbose: console.log });
// import Database from 'better-sqlite3';
// const db = new Database('./sqlite3.db', { verbose: console.log });

try {
    const q = `
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
    console.log('query:', q);
    // console.log('query:', q.replaceAll(/\n/g, ''));
    console.log('query:', q);

    const create = db.prepare(q);
    
    const result = create.run();
    console.log('result:', result)

    // const stmt = db.prepare("INSERT INTO lorem VALUES (?)");
    // for (let i = 0; i < 10; i++) {
    //     stmt.run("Ipsum " + i);
    // }
    // stmt.finalize();

    // db.each("SELECT rowid AS id, info FROM lorem", (err, row) => {
    //     console.log(row.id + ": " + row.info);
    // });
} catch (error) {
    console.log('error:', error);
}

// db.close();
