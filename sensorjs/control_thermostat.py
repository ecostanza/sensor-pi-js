# coding: utf-8
# This file is part of sensor-pi-js a simple platform to collect and visualize
# sensor data using Raspberry Pi, wireless sensor nodes and Web technology.
# 
# Copyright (C) 2025 Enrico Costanza e.costanza@ucl.ac.uk
#  
# This program is free software: you can redistribute it and/or modify it
# under the terms of the GNU General Public License as published by the Free
# Software Foundation, either version 3 of the License, or (at your option)
# any later version.
#  
# This program is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of  MERCHANTABILITY or
# FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for
# more details.
#  
# You should have received a copy of the GNU General Public License along with
# this program.  If not, see <http://www.gnu.org/licenses/>.

import sys
import sqlite3
from datetime import datetime
from time import sleep
import logging

from influxdb import InfluxDBClient
import requests

from thermostat_utils import switch_on, switch_off

if '-v' in sys.argv:
    logging.basicConfig(level=logging.INFO)
if '-vv' in sys.argv:
    logging.basicConfig(level=logging.DEBUG)


# connect to the database db.sqlite3
# conn = sqlite3.connect('db.sqlite3')
# cur = conn.cursor()

influx_client = InfluxDBClient(host='localhost', port=8086)
influx_client.switch_database('sdstore')

def get_expected_sensors():
    conn = sqlite3.connect('db.sqlite3')
    cur = conn.cursor()
    q = 'SELECT sensor FROM sensors WHERE expected;'
    res = cur.execute(q)
    data = res.fetchall()
    # print('select res.fetchall:', data)

    sensor_ids = [int(d[0]) for d in data]
    return sensor_ids

def get_setpoint_temperature(hour, minute):
    conn = sqlite3.connect('db.sqlite3')
    cur = conn.cursor()
    # get the current thermostat_slot
    slot_query = f'''SELECT temperature from thermostat_slots WHERE thermostat_day_profiles_id in (
        SELECT thermostat_day_profiles_id from thermostat_day_profiles_activations ORDER BY createdAt DESC LIMIT 1)
            AND hour={hour} AND minute={minute} LIMIT 1;'''
    cur.execute(slot_query)
    slot = cur.fetchone()
    setpoint_temperature = slot[0]

    print('setpoint_temperature:', setpoint_temperature)
    return setpoint_temperature

def get_current_temperature():
    # get the sensor ids from sqlite
    sensor_ids = get_expected_sensors()
    sensor_id_regex = '|'.join([str(i) for i in sensor_ids])

    # get the current temperature from the influxdb

    influx_query = f"""
                SELECT "value", "sensor_id" 
                FROM "temperature" 
                WHERE "sensor_id" =~ /{sensor_id_regex}/ 
                AND time > now() - 20m 
                GROUP BY * ORDER BY ASC LIMIT 1;"""

    rs = influx_client.query(influx_query)

    # logging.info(f'rs.items(): {rs.items()}')
    data = [
        list(iterator)[0] for ((measurement, _), iterator) in rs.items()
    ]
    data = {int(d['sensor_id']): round(d['value'], 3) for d in data}
    logging.info(f'data: {data}')
    
    if 61 in data:
        return data[61]
    else:
        return sum(data.values()) / len(data)

# main loop
while True:
    try:
        now = datetime.now()
        hour = now.hour
        minute = now.minute // 15 * 15

        # TODO: deal with temperature_boost

        setpoint_temperature = get_setpoint_temperature(hour, minute)

        current_temperature = get_current_temperature()

        control_period = 4 * 60

        delta = setpoint_temperature - current_temperature
        rate = 0.0
        if delta < 0.1:
            rate = 0.0
        elif delta > 2.0:
            rate = 1.0
        else:
            #rate = delta / 2.0
            rate = delta
            rate = min(rate, 1.0)

        if rate > 0.0:
            # TODO: if the heating status is already on, 
            # but the temperature is going down, 
            # force it on, it might be stuck because of the disconnection 

            # activate the heating
            logging.info('heating ON')
            r = switch_on()
            # logging.info(r.status_code)
            logging.info(r)
        else:
            # deactivate the heating
            logging.info('heating OFF')
            r = switch_off()
            # logging.info(r.status_code)
            logging.info(r)
        
        logging.info(f'setpoint: {setpoint_temperature}, current_temperature: {round(current_temperature, 2)}, delta: {round(delta, 2)}, rate: {rate}')

        delay = 0
        if rate > 0.0  and rate < 1.0:
            delay = control_period * rate
            logging.info(f'sleeping for {round(delay, 2)} seconds')
            sleep(delay)
            
            # TODO: deal with temperature_boost
            temp_mode = False
            if not temp_mode:
                # deactivate the heating
                logging.info('heating OFF')
                r = switch_off()
                # logging.info(r.status_code)
                logging.info(r)
            else:
                # logging.info('ignoring switch off because of temp mode')
                pass
        
        logging.info(f'sleeping for {round(control_period - delay, 2)} seconds')
        sleep(control_period - delay)
    except requests.exceptions.ConnectionError as e:
        logging.error('RequestException: ' + str(e))
        sleep(10)
