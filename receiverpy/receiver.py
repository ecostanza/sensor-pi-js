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


import time
# import datetime
# import os
# import socket

from influxdb import InfluxDBClient

from RFM69 import Radio, FREQ_433MHZ

from utils import datatype_LUT, decode_float, decode_ushort

client = InfluxDBClient(host='localhost', port=8086)
client.switch_database('sdstore')

node_id = 1
network_id = 100
#network_id = 210
#recipient_id = 2

print('setting radio up')
with Radio(
        FREQ_433MHZ, 
        node_id, 
        network_id, 
        isHighPower=True, 
        #verbose=True,
        interruptPin=22, # was 15
        resetPin=25, # was 22
        spiDevice=1
    ) as radio:
    print ("Radio up. Starting loop...")
    
    rx_counter = 0
    tx_counter = 0

    while True:
        # Every 1 seconds get packets
        if rx_counter > 1:
            rx_counter = 0
            
            data_points = []
            # Process packets
            for packet in radio.get_packets():
                print ('packet', packet)
                time_received = packet.received
                print(time_received)
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
                            print(f'{t[0]}: {value:.2f}')
                        elif t[1] == 'ushort':
                            value = decode_ushort(itr)
                            print(f'{t[0]}: {value}')
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
            if len(data_points) > 0:
                written = client.write_points(data_points)
                print(f'written: {written}')

        #print("Listening...", len(radio.packets), radio.mode_name)
        delay = 0.5
        rx_counter += delay
        time.sleep(delay)

        # 

print('out of with')

