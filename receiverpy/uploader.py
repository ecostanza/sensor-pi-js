# coding:utf-8

# This file is part of sensor-pi-js a simple platform to collect and visualize
# sensor data using Raspberry Pi, wireless sensor nodes and Web technology.

# Copyright (C) 2021 Enrico Costanza e.costanza@ucl.ac.uk

# This program is free software: you can redistribute it and/or modify it
# under the terms of the GNU General Public License as published by the Free
# Software Foundation, either version 3 of the License, or (at your option)
# any later version.

# This program is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
# FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for
# more details.

# You should have received a copy of the GNU General Public License along with
# this program. If not, see <http://www.gnu.org/licenses/>.


# import sys
# import cProfile

import time
import json
from pathlib import Path
from itertools import islice
import re

from influxdb import InfluxDBClient

import requests

from utils import get_expected_sensors

# pr = cProfile.Profile()

# delay = 0.5
delay = 1.0
# delay = 0.2
# delay = 0.02

client = InfluxDBClient(host='localhost', port=8086)
client.switch_database('sdstore')

url = 'https://iot.cs.ucl.ac.uk/energycoordination/data/'
headers = {"Content-Type": "application/json"}
fname = 'uploader_latest.txt'
f = Path(fname)
patt = re.compile('[\d]{4}-[\d]{2}-[\d]{2}T[\d]{2}:[\d]{2}:[\d]{2}\.[\d]+Z')

while True:
# if True:
    
    time_filter = ''
    if f.is_file():
        # get latest_ts from file
        # latest_ms = int(open(fname,'r').read())
        # latest_ms = int(f.read_text())
        # latest = f.read_text()
        latest = open(fname,'r').read()
        m = patt.match(latest)
        if m:
            # time_filter = f'WHERE time > {latest_ms}ms'
            time_filter = f"AND time > '{latest}'"
        else:
            time_filter = ''

    # query = f'SELECT * FROM "electricity_consumption" {time_filter}' 
    sensor_ids = get_expected_sensors()
    sensor_id_regex = '|'.join([str(i) for i in sensor_ids])
    query = f'SELECT * FROM /.*/ WHERE "sensor_id" =~ /{sensor_id_regex}/ {time_filter} LIMIT 10'
    
    print(query)
    rs = client.query(query)
    for ((measurement, _), iterator) in rs.items():
        print(measurement)
        # iterator = rs.get_points()
        to_upload = list(islice(iterator, 10))
        print('to_upload', to_upload)
        while len(to_upload) > 0:
            to_upload = [
                {
                    'time': i['time'],
                    'measurement': measurement,
                    'tags': {
                        'sensor_id': i['sensor_id']
                    },
                    'fields': {
                        'value': i['value']
                    }
                }
                for i in to_upload
            ]
            print('data_points', to_upload)

            # TODO: login on the server?

            try:
                # put the data to the server
                response = requests.put(
                    url,
                    data=json.dumps(to_upload),
                    headers=headers
                )
                # TODO: save the timestamp of the last data point uploaded
                # print('response.text', response.text[:200])
                # open('err.html', 'w').write(response.text)
                res = response.json()
                # print("res['written']", res['written'])

                # if response.status_code == 200:
                if res['written'] == True:
                    latest = to_upload[-1]['time']
                    m = patt.match(latest)
                    if m:
                        # latest = open(fname,'w').write(latest)
                        open(fname,'w').write(latest)
                to_upload = list(islice(iterator, 10))
            except Exception as e:
                print('exception:', e)
                time.sleep(delay*10)        

    time.sleep(delay)

    # print("awake\r", end='')
    # sys.stdout.flush()


