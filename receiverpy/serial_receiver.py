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

import re
from datetime import datetime
from struct import pack
import serial

from influxdb import InfluxDBClient

from utils import decode_float, decode_ushort, get_sampling_periods, store_sensor, datatype_LUT

logging.info('Serial Receiver starting')

client = InfluxDBClient(host='localhost', port=8086)
client.switch_database('sdstore')

patt = re.compile(r'\[(\d+)\] to \[(\d+)\] ([\dA-F]+)\s+\[RX_RSSI:\-(\d+)\]')

sensor_sampling_periods = get_sampling_periods()
logging.info('initial:', sensor_sampling_periods)

with serial.Serial('/dev/serial0', 19200, timeout=.2) as ser:
# with serial.Serial('/dev/serial0', 115200, timeout=.2) as ser:
    
    while True:
        # check if any of the frequencies changed in the DB
        new_sensor_sampling_periods = get_sampling_periods()
        if new_sensor_sampling_periods != sensor_sampling_periods:
            # TODO: this can be made more efficient by
            # sending only the differences
            print(new_sensor_sampling_periods)
            sensor_sampling_periods = new_sensor_sampling_periods

            for sensor_id, sp in sensor_sampling_periods.items():
                try:
                    # noise/ghost nodes can have IDs beyond 255, which make pack
                    # raise an exception, which needs to be caught and ignored
                    curr = pack('<BHBBB', sensor_id, sp, 255, 255, 255)
                    ser.write(curr)
                except Exception as e:
                    logging.error(f'exception from {repr(sensor_id)}, {repr(sp)}')
        
        line = ser.readline()   # read a '\n' terminated line
        if len(line) > 0:
            line = line.decode('utf-8')
            # logging.info(line)
            logging.debug(repr(line[-1]))
            if line[-1] != "\n":
                logging.error(f'Incomplete line: {line}')
                logging.error('Skipping')
                continue

            m = patt.match(line)
            if m:
                time_received = datetime.utcnow()
                sender, destination, data, rssi = m.groups()
                rssi = int(rssi)
                if destination != '1':
                    logging.error('destination is not 1!')
                    logging.error(line)
                    continue
                logging.info(f'{sender} {destination} {data} {rssi}')
                int_data = []
                it = iter(data)
                for c in it:
                    curr_hex = c + next(it)
                    value = int(curr_hex, base=16)
                    int_data.append(value)
                    # logging.info(curr_hex, value)
                
                data_points = []
                # logging.info(int_data)
                it = iter(int_data)
                for item in it:
                    if item == 0:
                        continue
                    
                    try:
                        label, data_type = datatype_LUT[item]
                        # logging.info(item, data_type, label)

                        if data_type == 'float':
                            value = decode_float(it)
                        elif data_type == 'ushort':
                            value = decode_ushort(it)
                        else:
                            raise NotImplementedError

                        logging.debug(f'[{sender}] {label}: {value}')

                        current = {
                            'time': time_received,
                            'measurement': label,
                            'tags': {
                                'sensor_id': sender
                            },
                            'fields': {
                                'value': value
                            }
                        }
                        data_points.append(current)


                    except KeyError:
                        logging.error('error! Data type not recognized')
                        continue
                    except:
                        logging.error('decoding error!')
                        continue
                
                sender = int(sender)

                # check if this sensor is already in the db
                if not sender in sensor_sampling_periods.keys():
                    # if not, store it
                    try:
                        store_sensor(sender)
                        new_sensor_sampling_periods = get_sampling_periods()
                        if new_sensor_sampling_periods != sensor_sampling_periods:
                            # TODO: this can be made more efficient by
                            # sending only the differences
                            # print(new_sensor_sampling_periods)
                            sensor_sampling_periods = new_sensor_sampling_periods
                            for sensor_id, sp in sensor_sampling_periods.items():
                                # noise/ghost nodes can have IDs beyond 255, which make pack
                                # raise an exception, which needs to be caught and ignored
                                try:
                                    curr = pack('<BHBBB', sensor_id, sp, 255, 255, 255)                                
                                    ser.write(curr)
                                except Exception as e:
                                    logging.error(f'exception from {repr(sensor_id)}, {repr(sp)}')
                    except Exception as e:
                        logging.error(f'exception from insert! {e}')

                current = {
                    'time': time_received,
                    'measurement': 'rssi',
                    'tags': {
                        'sensor_id': sender
                    },
                    'fields': {
                        'value': rssi
                    }
                }
                data_points.append(current)
                if len(data_points) > 0:
                    written = client.write_points(data_points)
                    # print(f'written: {written}')
                    logging.debug(f'data_points: {data_points}')

            # print()

print('after with')
