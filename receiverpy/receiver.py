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

import sys
# import cProfile

import logging

if '-v' in sys.argv:
    logging.basicConfig(level=logging.INFO)
if '-vv' in sys.argv:
    logging.basicConfig(level=logging.DEBUG)

import time

from influxdb import InfluxDBClient

from RFM69 import Radio, FREQ_433MHZ

from utils import decode_float, decode_ushort, get_sampling_periods, store_sensor, datatype_LUT
from struct import pack

import requests

logging.info('SPI Receiver starting')
# pr = cProfile.Profile()

client = InfluxDBClient(host='localhost', port=8086)
client.switch_database('sdstore')

node_id = 1
network_id = 100
#network_id = 210
#recipient_id = 2

         

logging.info('setting radio up')
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
    logging.info("Radio up. Starting loop...")
    
    rx_counter = 0
    tx_counter = 0

    sensor_sampling_periods = get_sampling_periods()
    logging.info(f'initial: {sensor_sampling_periods}')

    while True:
    # for _ in range(10):
        # periodically get packets (there is a delay at the end of the loop)
        
        data_points = []
        # Process packets
        curr_packets = radio.get_packets()

        # first send acknowledgements
        for packet in curr_packets:
            try:
                sampling_period = sensor_sampling_periods[packet.sender]
            except KeyError:
                sampling_period = 30
            # radio.send_ack(packet.sender, pack('<H', sampling_period).decode("utf-8"))
            radio.send_ack(packet.sender, pack('<bH', 24, sampling_period).decode("utf-8"))
            logging.info(f'sent ack to {packet.sender}')
        else:
            # the acknowledgements are expected within 200ms, so
            # we sleep no more than 100ms
            delay = 0.1
            # delay = 0.2
            # delay = 0.02
            time.sleep(delay)

        # check if any of the frequencies changed in the DB
        new_sensor_sampling_periods = get_sampling_periods()
        if new_sensor_sampling_periods != sensor_sampling_periods:
            logging.debug(new_sensor_sampling_periods)
            sensor_sampling_periods = new_sensor_sampling_periods
        
        # then process the data and store it
        for packet in curr_packets:
            logging.info(f'packet {packet}')
            time_received = packet.received
            # logging.info(time_received)
            # logging.debug(f'data {packet.data_string}')
            # decode data buffer
            # types 1, 2 and 3 are floats, 4-15 are uint16 (aka unsigned short)
            itr = iter(packet.data)
            for item in itr:
                # logging.info(item)
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
                    logging.info('error! Data type not recognized')
                    continue
                    # raise NotImplementedError(f'item:{item}')
                except StopIteration as sie:
                    logging.info(f'StopIteration error! {sie}')
                    continue
                except Exception as e:
                    logging.info(f'error! {e}')
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
            logging.debug(current)

            # check if this sensor is already in the db
            # if not packet.sender in existing_sensors:
            if not packet.sender in sensor_sampling_periods.keys():
                # if not, store it
                try:
                    store_sensor(packet.sender)
                    new_sensor_sampling_periods = get_sampling_periods()
                    if new_sensor_sampling_periods != sensor_sampling_periods:
                        # print(new_sensor_sampling_periods)
                        sensor_sampling_periods = new_sensor_sampling_periods
                except Exception as e:
                    logging.error(f'exception from insert! {e}')


        if len(data_points) > 0:
            written = client.write_points(data_points)
            logging.info(f'written: {written}')

        #print("Listening...", len(radio.packets), radio.mode_name)
        # print('sleep..', end='')      
        # sys.stdout.flush()


        # print("awake\r", end='')
        # sys.stdout.flush()

# pr.disable()
# pr.dump_stats('data.prof')

print('out of with')

