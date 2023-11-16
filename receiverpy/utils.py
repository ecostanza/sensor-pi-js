# coding:utf-8
from struct import unpack
import time
import sqlite3

datatype_LUT = {
    1: ('temperature', 'float'),
    2: ('humidity', 'float'),
    3: ('CO2', 'float'),
    4: ('pm10_standard', 'ushort'),
    5: ('pm25_standard', 'ushort'),
    6: ('pm100_standard', 'ushort'),
    7: ('pm10_env', 'ushort'),
    8: ('pm25_env', 'ushort'),
    9: ('pm100_env', 'ushort'),
    10: ('particles_03um', 'ushort'),
    11: ('particles_05um', 'ushort'),
    12: ('particles_10um', 'ushort'),
    13: ('particles_25um', 'ushort'),
    14: ('particles_50um', 'ushort'),
    15: ('particles_100um', 'ushort'),
    16: ('TVOC', 'ushort'),
    17: ('eCO2', 'ushort'),
    18: ('rawH2', 'ushort'),
    19: ('rawEthanol', 'ushort'),

    20: ('electricity_consumption', 'float'),

    21: ('battery', 'ushort'),

    22: ('eCO2_base', 'ushort'),
    23: ('TVOC_base', 'ushort'),

    24: ('sampling_period', 'ushort'),

}

# the Arduino is little-endian
id_fmt = '<b'
float_fmt = '<f'
ushort_fmt = '<H'
def decode_float(itr):
    buf = bytes((next(itr) for _ in range(4)))
    return unpack(float_fmt, buf)[0]

def decode_ushort(itr):
    buf = bytes((next(itr) for _ in range(2)))
    return unpack(ushort_fmt, buf)[0]

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

def get_expected_sensors():
    cur = con.cursor()
    q = 'SELECT sensor FROM sensors WHERE expected;'
    res = cur.execute(q)
    data = res.fetchall()
    # print('select res.fetchall:', data)

    sensor_ids = [int(d[0]) for d in data]
    return sensor_ids

annotation_header = [
    # 'id', # INTEGER PRIMARY KEY AUTOINCREMENT,
    'start', # INTEGER   NOT NULL,
    'duration_seconds', # INTEGER   NOT NULL,
    'type', # TEXT   NOT NULL,
    'description', # TEXT,
    'consumption', # REAL,
    'flexibility', # TEXT,
    'measurement', # TEXT   NOT NULL,
    'sensor', # TEXT   NOT NULL,
    'createdAt', # INTEGER   NOT NULL,
    'updatedAt', # INTEGER   NOT NULL   
]

def get_annotations(recent):
    cur = con.cursor()
    timestamp = int((1 + time.mktime(recent.timetuple())) * 1000)

    annotation_query_items = annotation_header[:-2] + [
        "datetime(createdAt/1000, 'unixepoch')", # INTEGER   NOT NULL,
        "datetime(updatedAt/1000, 'unixepoch')" # INTEGER   NOT NULL,
    ]
    q = f'SELECT {",".join(annotation_query_items)} FROM annotations WHERE updatedAt > {timestamp};'

    # print(q)
    res = cur.execute(q)
    data = res.fetchall()
    # print('select res.fetchall:', data)

    annotations = [dict(zip(annotation_header, d)) for d in data]
    
    return annotations

