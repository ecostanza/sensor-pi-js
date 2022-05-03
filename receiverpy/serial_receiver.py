# coding:utf-8

import re
from datetime import datetime

import serial
from influxdb import InfluxDBClient

from utils import decode_float, decode_ushort, datatype_LUT

print('Serial Receiver starting')

client = InfluxDBClient(host='localhost', port=8086)
client.switch_database('sdstore')

patt = re.compile(r'\[(\d+)\] to \[(\d+)\] ([\dA-F]+)\s+\[RX_RSSI:\-(\d+)\]')

# with serial.Serial('/dev/ttyAMA0', 115200, timeout=.2) as ser:
with serial.Serial('/dev/serial0', 115200, timeout=.2) as ser:
    try:
        while True:
            line = ser.readline()   # read a '\n' terminated line
            if len(line) > 0:
                line = line.decode('utf-8')
                # print(line)
                # print(repr(line[-1]))
                if line[-1] != "\n":
                    print('Incomplete line: ', line)
                    print('Skipping')
                    continue

                m = patt.match(line)
                if m:
                    time_received = datetime.utcnow()
                    sender, destination, data, rssi = m.groups()
                    rssi = int(rssi)
                    if destination != '1':
                        print('destination is not 1!')
                        print(line)
                        continue
                    print(sender, destination, data, rssi)
                    int_data = []
                    it = iter(data)
                    for c in it:
                        curr_hex = c + next(it)
                        value = int(curr_hex, base=16)
                        int_data.append(value)
                        # print(curr_hex, value)
                    
                    data_points = []
                    # print(int_data)
                    it = iter(int_data)
                    for item in it:
                        if item == 0:
                            continue
                        
                        try:
                            label, data_type = datatype_LUT[item]
                            # print(item, data_type, label)

                            if data_type == 'float':
                                value = decode_float(it)
                            elif data_type == 'ushort':
                                value = decode_ushort(it)
                            else:
                                raise NotImplementedError

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
                            print('error! Data type not recognized')
                            continue
                    
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
                        print(f'written: {written}')

                        # for dp in data_points:
                        #     print(dp)

                # print()
    except KeyboardInterrupt:
        pass

print('after with')
