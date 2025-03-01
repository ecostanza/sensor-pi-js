# Thermostat

The thermostat functionality relies on a z-way thermostat that supports on and 
off commands, and a z-way hub that allows access to the thermostat via http. 
For example, a raspberry pi with one of these modules: 
https://z-wave.me/products/razberry/razberry-revisions/ Note this is currently 
assumed to be a separate RPi than the one running sensor-pi-js 

The URL to control the thermostat, the one for the zway authentication and the 
credentials need to be stored in a file `private.py` with the following 
constants:

```
ZWAY_UNAME = 'username here'
ZWAY_PASS = 'password here'

AUTH_URL = 'login URL here'

THERMOSTAT_URL = 'thermostat device URL here'
```

The thermostat functionality is implemented as combination of python and js 
scripts. It includes a basic front-end, as well as scripts to actually control 
the temperature and to deal with the programmes. 

It requires new SQL tables. To create them, run 
`node create_thermostat_tables.js` and to populate them, run 
`node populate_thermostat_tables.js`. If something goes wrong, run 
`python drop_thermostat_tables.py` to remove the tables and then you need to 
create them again. 

The thermostat supports "day profiles", each containing "slots" -- a slot is a 
temperature setting for 15 minutes, so each day profile is expected to have 
4*24 slots. A day profile can be "activated" by creating a "day profile 
activation", which is a row in a DB table containing the desired day profile id 
and the time (for logging). The most recent day profile activation is used to 
determine what day profile should be used.

A cron job calls `set_default_day_profile.py` every day at midnight. A day 
profile should be set to be the default one through a flag in the db table. 

The boost functionality is yet to be added. 

The UI currently only allows to select one of the available day profiles. The 
configuration of day profiles is currently hard coded in 
`populate_thermostat_tables.js`.  

The temperature control is done in `control_thermostat.py` which needs to be 
setup as a systemd service (similar to `receiver.py` and `uploader.py`).

