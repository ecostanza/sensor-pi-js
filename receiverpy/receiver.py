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

from influxdb import InfluxDBClient

from RFM69 import Radio, FREQ_433MHZ

from utils import datatype_LUT, decode_float, decode_ushort
from struct import pack

import requests

# pr = cProfile.Profile()

client = InfluxDBClient(host='localhost', port=8086)
client.switch_database('sdstore')

node_id = 1
network_id = 100
#network_id = 210
#recipient_id = 2

import time
import sqlite3
con = sqlite3.connect("/home/pi/sensorjs/db.sqlite3")

# pr.enable()

def get_sampling_periods():
    cur = con.cursor()
    q = 'SELECT sensor, sampling_period FROM sensors'
    res = cur.execute(q)
    data = res.fetchall()
    # print('select res.fetchall:', data)

    sensor_periods = dict((int(d[0]), d[1]) for d in data)
    return sensor_periods

def store_sensor(sensor_id):
    now = int(time.time())
    q = f"""
        INSERT INTO sensors 
        (sensor, label, createdAt, updatedAt) 
        VALUES ({sensor_id}, "sensor {sensor_id}", {now}, {now});"""
    # con = sqlite3.connect("../sensorjs/db.sqlite3")
    cur = con.cursor()

    res = cur.execute(q)
    res = con.commit()

    # data = res.fetchall()
    # print('insert fetchall:', data)
    return get_sampling_periods()
         

print('setting radio up')
# for radio modules directly connected to the RPi the parameters should be:
# interruptPin=24, 
# resetPin=5, 
# spiDevice=0
with Radio(
        FREQ_433MHZ, 
        node_id, 
        network_id, 
        isHighPower=True, 
        #autoAcknowledge=True,
        autoAcknowledge=False,
        promiscuousMode=False,
        # verbose=True,
        interruptPin=22, # was 15
        resetPin=25, # was 22
        spiDevice=1
    ) as radio:
    print ("Radio up. Starting loop...")
    
    rx_counter = 0
    tx_counter = 0

    sensor_sampling_periods = get_sampling_periods()
    print('initial:', sensor_sampling_periods)

    while True:
    # for _ in range(10):
        # periodically get packets (there is a delay at the end of the loop)
        
        data_points = []
        # Process packets
        curr_packets = radio.get_packets()

        # first send acknowledgements
        for packet in curr_packets:
            radio.send_ack(packet.sender, pack('<H', 10).decode("utf-8"))
            # print(f'sent ack to {packet.sender}')

        # TODO: check if any of the frequencies changed in the DB
        new_sensor_sampling_periods = get_sampling_periods()
        if new_sensor_sampling_periods != sensor_sampling_periods:
            print(new_sensor_sampling_periods)
            sensor_sampling_periods = new_sensor_sampling_periods
        
        # then process the data and store it
        for packet in curr_packets:
            print ('packet', packet)
            time_received = packet.received
            # print(time_received)
            # print(dir(packet))
            #print ('data', packet.data_string)
            # decode data buffer
            # types 1, 2 and 3 are floats, 4-15 are uint16 (aka unsigned short)
            itr = iter(packet.data)
            for item in itr:
                #print(item)
                if item == 0:
                    # TODO: break instead?
                    continue
                try:
                    t = datatype_LUT[item]
                    if t[1] == 'float':
                        value = decode_float(itr)
                        # print(f'{t[0]}: {value:.2f}')
                    elif t[1] == 'ushort':
                        value = decode_ushort(itr)
                        # print(f'{t[0]}: {value}')
                    else:
                        value = next(itr)
                        # raise NotImplementedError
                    # TODO: check/amend to work well with multiple nodes
                    current = {
                        'time': time_received,
                        'measurement': t[0],
                        'tags': {
                            'sensor_id': packet.sender
                        },
                        'fields': {
                            'value': value
                        }
                    }
                    data_points.append(current)
                except KeyError:
                    print('error! Data type not recognized')
                    continue
                    # raise NotImplementedError(f'item:{item}')
                except StopIteration as sie:
                    print('StopIteration error!', sie)
                    continue
                except Exception as e:
                    print('error!', e)
                    continue
            # store RSSI
            current = {
                'time': time_received,
                'measurement': 'rssi',
                'tags': {
                    'sensor_id': packet.sender
                },
                'fields': {
                    'value': packet.RSSI
                }
            }
            data_points.append(current)

            # check if this sensor is already in the db
            # if not packet.sender in existing_sensors:
            if not packet.sender in sensor_sampling_periods.keys():
                # if not, store it
                try:
                    store_sensor(packet.sender)
                    new_sensor_sampling_periods = get_sampling_periods()
                    if new_sensor_sampling_periods != sensor_sampling_periods:
                        print(new_sensor_sampling_periods)
                        sensor_sampling_periods = new_sensor_sampling_periods
                except Exception as e:
                    print('exception from insert!', e)


        if len(data_points) > 0:
            written = client.write_points(data_points)
            # print(f'written: {written}')

        #print("Listening...", len(radio.packets), radio.mode_name)
        # print('sleep..', end='')      
        # sys.stdout.flush()

        delay = 0.5
        # delay = 0.2
        # delay = 0.02
        time.sleep(delay)

        # print("awake\r", end='')
        # sys.stdout.flush()

# pr.disable()
# pr.dump_stats('data.prof')

print('out of with')

