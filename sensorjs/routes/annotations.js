/*
 * This file is part of sensor-pi-js a simple platform to collect and visualize
 * sensor data using Raspberry Pi, wireless sensor nodes and Web technology.
 * 
 * Copyright (C) 2022 Enrico Costanza e.costanza@ucl.ac.uk
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
const db = require('better-sqlite3')('./db.sqlite3');

router.get('/annotations-test', async function(req, res) {
    return res.render('annotations-test.html');
});

const annotation_columns = [
    'id',
    'start',
    'duration_seconds',
    
    'type',
    'description',
    
    'consumption',
    
    'flexibility',
    
    'measurement',
    'sensor',
    
    'createdAt',
    'updatedAt'
];

router.get('/annotations', async function(req, res) {
    // TODO: add filters
    try {
        const query = `SELECT ${annotation_columns.join()} from annotations;`;
        // console.log('query:', query);
        const select = db.prepare(query);
        // console.log('prepare returned:', select);
        const annotations = select.all();
        // console.log('annotations:', annotations);
        return res.json(annotations);
    } catch (error) {
        return res.json({'error': error});
    }
});

function populate_annotation_data (req, updating) {
    const expected_fields = [
        'start',
        'duration_seconds',
        'type', 
        'measurement',
        'sensor'
    ];
    const optional_fields = [
        'description', //?
        'consumption', //?
        'flexibility', //?
    ];
    let data = {};
    for (const f of expected_fields) {
        // TODO: raise exception if not present
        data[f] = req.body[f];
    }
    for (const f of optional_fields) {
        data[f] = req.body[f];
    }
    if (!updating) {
        data['createdAt'] = (new Date()).getTime();
    }
    data['updatedAt'] = (new Date()).getTime();
    return data;
}

router.put('/annotations', async function(req, res) {
    // get data
    // req.body
    // TODO: handle exception? (in case field is missing)
    try {
        let data = populate_annotation_data(req);
        
        let columns = [];
        let values = [];
        for (const key in data) {
            columns.push(key);
            values.push("'" + data[key] + "'");
        }

        const query = `
        INSERT INTO annotations 
        (${columns.join(",\n")}) 
        VALUES (${values.join(",\n")});
        `;
        // console.log('query:', query);
        const insert = db.prepare(query);
        // console.log('prepare returned:', insert);
        const info = insert.run();
        // console.log('info:', info);

        return res.json(info);
    } catch (error) {
        return res.json({'error': error});
    }
});

// DELETE /annotation/:id
router.delete('/annotations/:id', async function (req, res) {
    // delete 
    const annotation_id = parseInt(req.params['id'], 10);
    try {
        const query = `DELETE from annotations where id = ${annotation_id}`;
        const statment = db.prepare(query);
        const result = statment.run();
        // console.log('delete result:', result);
        res.json(result);
    } catch (error) {
        console.log('delete error:', error);
        res.json ({'error': error});
    }
});

// POST /annotation/:id
router.post('/annotations/:id', async function (req, res) {
    // updated 
    const annotation_id = parseInt(req.params['id'], 10);
    console.log('req.body', JSON.stringify(req.body));
    //let data = populate_annotation_data(req);
    let data = [];
    for (const k in req.body) {
        if (annotation_columns.includes(k)) {
            data.push(`${k} = '${req.body[k]}'`);
        }
    }
    try {
        const query = `
        UPDATE annotations
        SET ${data.join()}
        WHERE id = ${annotation_id};
        `;
        console.log('query', query);
        const statement = db.prepare(query);
        const result = statement.run();
        // console.log('update result:', result);
        
        res.json(result);
    } catch (error) {
        console.log('update error:', error);
        res.json ({'error': error});
    }
});

module.exports = router;
