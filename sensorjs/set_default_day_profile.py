# coding:utf-8
import sqlite3
import time

# connect to the database db.sqlite3
conn = sqlite3.connect('db.sqlite3')
cur = conn.cursor()

# get all the thermostat_day_profiles
# cur.execute("SELECT * FROM thermostat_day_profiles;")
# day_profiles = cur.fetchall()
# for p in day_profiles:
#     print(p)

# get the thermostat_day_profiles where default_profile is True
cur.execute("SELECT id FROM thermostat_day_profiles WHERE default_profile = 1;")
default_profile = cur.fetchone()
default_profile = default_profile[0]
print(default_profile)

now = int(time.time())

# insert a new row in thermostat_day_profiles_activations with thermostat_day_profiles_id = default_profile and createdAt = updatedAt = now
cur.execute(
        "INSERT INTO thermostat_day_profiles_activations (thermostat_day_profiles_id, createdAt, updatedAt) VALUES (?, ?, ?);", 
        (default_profile, now, now)
    )

# commit the changes
conn.commit()

