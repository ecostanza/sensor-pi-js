# coding:utf-8
import sqlite3
import sys
import time

# connect to the database db.sqlite3
conn = sqlite3.connect('db.sqlite3')
cur = conn.cursor()

# get all the thermostat_day_profiles
cur.execute("SELECT * FROM thermostat_day_profiles;")
day_profiles = cur.fetchall()
for p in day_profiles:
    print(p)

if len(sys.argv) < 2:
    sys.exit('No thermostat_day_profile id given')
    
selected_id = sys.argv[1]
print('selected_id: ', selected_id)
# get the thermostat_day_profiles where default_profile is True
cur.execute(f"SELECT * FROM thermostat_day_profiles WHERE id = {selected_id};")
selected_profile = cur.fetchone()
selected_profile = selected_profile[0]
print(selected_profile)

now = int(time.time())

# insert a new row in thermostat_day_profiles_activations with thermostat_day_profiles_id = default_profile and createdAt = updatedAt = now
cur.execute(
        "INSERT INTO thermostat_day_profiles_activations (thermostat_day_profiles_id, createdAt, updatedAt) VALUES (?, ?, ?);", 
        (selected_profile, now, now)
    )

# commit the changes
conn.commit()

