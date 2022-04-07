# coding:utf-8
from struct import unpack

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

