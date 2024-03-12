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


import sys
# import cProfile

import logging

if '-v' in sys.argv:
    logging.basicConfig(level=logging.INFO)
if '-vv' in sys.argv:
    logging.basicConfig(level=logging.DEBUG)

import time
import json
from pathlib import Path
from itertools import islice
import re
from datetime import datetime, timedelta

from influxdb import InfluxDBClient

import requests

from utils import get_expected_sensors, get_annotations

# pr = cProfile.Profile()

# delay = 0.5
delay = 1.0
# delay = 0.2
# delay = 0.02

client = InfluxDBClient(host='localhost', port=8086)
client.switch_database('sdstore')

data_url = 'https://iot.cs.ucl.ac.uk/energycoordination/data/'
annotations_url = 'https://iot.cs.ucl.ac.uk/energycoordination/batch_annotations/'
headers = {"Content-Type": "application/json"}
fname = 'uploader_latest.txt'
f = Path(fname)
annotations_fname = 'annotations_latest.txt'
annotations_f = Path(annotations_fname)
patt = re.compile('[\d]{4}-[\d]{2}-[\d]{2}T[\d]{2}:[\d]{2}:[\d]{2}\.[\d]+Z')

def process_annotations():
    latest_dt = datetime.now() - timedelta(days=1)
    logging.debug(f'default latest_dt {latest_dt}')
    if annotations_f.is_file():
        # get latest_ts from file
        annotations_latest = open(annotations_fname,'r').read()
        logging.debug(f'annotations_latest {annotations_latest}')
        m = patt.match(annotations_latest)
        if m:
            latest_dt = datetime.strptime(annotations_latest.strip(), '%Y-%m-%dT%H:%M:%S.%fZ')
            logging.debug(f'latest_dt {latest_dt}')
            
    # retrieve recent annotations from the db
    annotations = get_annotations(latest_dt)
    
    if len(annotations) > 0:
        try:
            # post the annotations to the server
            annotations_json = json.dumps(annotations)
            logging.debug(f'annotations_json: {annotations_json}')
            response = requests.post(
                annotations_url,
                data=annotations_json,
                headers=headers
            )
            logging.debug(f'response: {response}')
            res = response.json()

            if res['written'] == True:
                annotations_latest = annotations[-1]['updatedAt']
                logging.debug(f'annotations_latest: {annotations_latest}')
                # convert unix timestamp in annotations_latest to datetime
                annotations_latest_dt = datetime.strptime(annotations_latest, '%Y-%m-%d %H:%M:%S')
                logging.debug(f'annotations_latest_dt: {annotations_latest_dt}')
                open(annotations_fname,'w').write(annotations_latest_dt.strftime('%Y-%m-%dT%H:%M:%S.%fZ'))
            
        except Exception as e:
            logging.error(f'exception: {e}')
            time.sleep(delay*10)
    else:
        logging.info('no new annotations')

while True:
# if True:
    
    time_filter = ''
    if f.is_file():
        # get latest_ts from file
        latest_str = open(fname,'r').read()
        try:
            # 2023-11-20T20:38:39.480245Z
            latest_dt = datetime.strptime(latest_str.strip(), '%Y-%m-%dT%H:%M:%SZ') 
            latest_dt = min(latest_dt, datetime.now())
        except Exception as e:
            logging.error(f'exception: {e}')
            # TODO: get the oldest timestamp in the db
            latest_dt = datetime.now() - timedelta(hours=1)
    else:
        # TODO: get the oldest timestamp in the db
        latest_dt = datetime.now() - timedelta(hours=1)

    query_minutes = 10
    start_str = latest_dt.strftime('%Y-%m-%dT%H:%M:%SZ')
    end = min(latest_dt + timedelta(minutes=query_minutes), datetime.now())
    end_str = end.strftime('%Y-%m-%dT%H:%M:%SZ')
    # time_filter = f'WHERE time > {latest_ms}ms'
    time_filter = f"AND time > '{start_str}' AND time <= '{end}'"

    # query = f'SELECT * FROM "electricity_consumption" {time_filter}' 
    sensor_ids = get_expected_sensors()
    sensor_id_regex = '|'.join([str(i) for i in sensor_ids])
    upload_size = 50
    query = f'SELECT * FROM /.*/ WHERE "sensor_id" =~ /{sensor_id_regex}/ {time_filter}'
    
    total_uploaded = 0

    logging.info(query)
    rs = client.query(query)
    for ((measurement, _), iterator) in rs.items():
        logging.info(measurement)
        
        to_upload = list(islice(iterator, upload_size))
        logging.debug(f'to_upload {to_upload}')
        logging.info(f'{len(to_upload)} data points to upload')
        total_uploaded += len(to_upload)

        while len(to_upload) > 0:
            formatted = [
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
                for i in to_upload if (
                    'sensor_id' in i and 
                    'value' in i and 
                    'time' in i
                    )
                ]

            logging.info(f'uploading {len(formatted)} data points')
            try:
                logging.info(formatted[0])
                logging.info(formatted[-1])
            except Exception as e:
                logging.info('no data?')

            if len(formatted) == 0:
                continue

            try:
                # put the data to the server
                response = requests.put(
                    data_url,
                    data=json.dumps(formatted),
                    headers=headers
                )

                res = response.json()
                logging.info(f"res['written']: {res['written']}\n")

                # get the next slice of data points                
                to_upload = list(islice(iterator, upload_size))

            except Exception as e:
                logging.info(f'exception: {e}')
                time.sleep(delay*2)
    
    if total_uploaded > 4:
        delay = 1
    else:
        delay = 15
    logging.info(f'uploaded {total_uploaded} data points, delay: {delay} seconds')

    open(fname,'w').write(end_str)
    logging.info(f'start_str {start_str}')
    logging.info(f'end_str {end_str}')

    # deal with annotations
    process_annotations()
    time.sleep(delay)



