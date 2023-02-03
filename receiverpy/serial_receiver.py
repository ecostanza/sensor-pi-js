# coding:utf-8

import re
from datetime import datetime
from struct import pack
import serial

from influxdb import InfluxDBClient

from utils import decode_float, decode_ushort, get_sampling_periods, store_sensor, datatype_LUT

print('Serial Receiver starting')

client = InfluxDBClient(host='localhost', port=8086)
client.switch_database('sdstore')

patt = re.compile(r'\[(\d+)\] to \[(\d+)\] ([\dA-F]+)\s+\[RX_RSSI:\-(\d+)\]')

sensor_sampling_periods = get_sampling_periods()
print('initial:', sensor_sampling_periods)

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
                curr = pack('<BHBBB', sensor_id, sp, 255, 255, 255)
                ser.write(curr)
        
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
                            print(new_sensor_sampling_periods)
                            sensor_sampling_periods = new_sensor_sampling_periods
                            for sensor_id, sp in sensor_sampling_periods.items():
                                curr = pack('<BHBBB', sensor_id, sp, 255, 255, 255)
                                ser.write(curr)
                    except Exception as e:
                        print('exception from insert!', e)

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

            # print()

print('after with')
