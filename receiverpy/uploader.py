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

from influxdb import InfluxDBClient

import requests

# pr = cProfile.Profile()

client = InfluxDBClient(host='localhost', port=8086)
client.switch_database('sdstore')

url = 'https://iot.cs.ucl.ac.uk/energycoordination/data/'
headers = {"Content-Type": "application/json"}
fname = 'uploader_latest.txt'
f = Path(fname)

while True:
# if True:
    
    time_filter = ''
    if f.is_file():
        # get latest_ts from file
        # latest_ms = int(open(fname,'r').read())
        # latest_ms = int(f.read_text())
        # latest = f.read_text()
        latest = open(fname,'r').read()
        # time_filter = f'WHERE time > {latest_ms}ms'
        time_filter = f"WHERE time > '{latest}'"

    query = f'SELECT * FROM "electricity_consumption" {time_filter}' 
    
    print(query)
    rs = client.query(query)
    iterator = rs.get_points()
    to_upload = list(islice(iterator, 10))
    while len(to_upload) > 0:
        to_upload = [
            {
                'time': i['time'],
                'measurement': 'electricity_consumption',
                'tags': {
                    'sensor_id': i['sensor_id']
                },
                'fields': {
                    'value': i['value']
                }
            }
            for i in to_upload
        ]
        # print('data_points', to_upload)

        # TODO: login on the server?

        # TODO: put the data to the server
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
            latest = open(fname,'w').write(latest)
        to_upload = list(islice(iterator, 10))


    # delay = 0.5
    delay = 1.0
    # delay = 0.2
    # delay = 0.02
    time.sleep(delay)

    # print("awake\r", end='')
    # sys.stdout.flush()


