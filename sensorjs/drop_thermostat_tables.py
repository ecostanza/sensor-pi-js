# coding:utf-8
import sqlite3

# connect to the database db.sqlite3
conn = sqlite3.connect('db.sqlite3')
cur = conn.cursor()

# get the list of tables
cur.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = cur.fetchall()
tables = [table[0] for table in tables]

# keep only the tables that start with 'thermostat_'
thermostat_tables = [table for table in tables if table.startswith('thermostat_')]
for table in thermostat_tables:
    cur.execute("DROP TABLE %s;" % table)

# commit the changes
conn.commit()

