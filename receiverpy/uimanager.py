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

import os, sys
import socket
import time

import busio
from digitalio import DigitalInOut, Direction, Pull
import board
import adafruit_ssd1306

# from https://stackoverflow.com/a/28950776/6872193
def get_ip():
    # s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    # try:
    #     # doesn't even have to be reachable
    #     s.connect(('10.255.255.255', 1))
    #     ip = s.getsockname()[0]
    # except Exception:
    #     ip = '10.0.0.5'
    # finally:
    #     s.close()
    # return ip
    # ip = os.system('hostname -I')
    ip = '127.0.0.1'
    while ip.startswith('127') or len(ip) < 7:
        ip = os.popen('hostname -I').read()
        print(repr(ip))
        time.sleep(1)
    return ip

ip = get_ip()


# Button A
btnA = DigitalInOut(board.D5)
btnA.direction = Direction.INPUT
btnA.pull = Pull.UP

# Button B
# btnB = DigitalInOut(board.D6)
# btnB.direction = Direction.INPUT
# btnB.pull = Pull.UP

# Button C
btnC = DigitalInOut(board.D12)
btnC.direction = Direction.INPUT
btnC.pull = Pull.UP

# Create the I2C interface.
i2c = busio.I2C(board.SCL, board.SDA)

# 128x32 OLED Display
reset_pin = DigitalInOut(board.D4)
display = adafruit_ssd1306.SSD1306_I2C(128, 32, i2c, reset=reset_pin)
# Clear the display.
display.fill(0)
display.show()
width = display.width
height = display.height



all_states = ['idle', 'pre-power-off']

state = 'idle'

while True:

    # 
    # Draw a black filled box to clear the image.
    display.fill(0)

    if state == 'idle':
        display.text('http://' + str(ip), 0, 0, 1)
        display.text('or: sensor.local', 0, 10, 1)
        display.text(f'{time.strftime("%H:%M")}', 40, height - 7, 1)

        display.text('Power', width-35, height-15, 1)
        display.text('off', width-35, height-7, 1)

        if not btnC.value:
            # Button C Pressed
            display.fill(0)
            display.text('Power off requested', 0, 0, 1)
            #display.show()
            #time.sleep(.4)
            state = 'pre-power-off'

    elif state == 'pre-power-off':
        display.text('Confirm power off?', 0, 0, 1)

        display.text('Yes', 0, height-7, 1)
        display.text('No', width-35, height-7, 1)

        # Check buttons
        if not btnA.value:
            # Button A Pressed
            display.fill(0)
            display.text('When the green light', 0, 0, 1)
            display.text('stays off you can', 0, 10, 1)
            display.text('unplug me. Goodbye..', 0, 20, 1)
            display.show()
            #time.sleep(.4)
            os.system("sudo shutdown -h now")
            sys.exit()

        if not btnC.value:
            # Button C Pressed
            display.fill(0)
            display.text('Power off cancelled', 0, 0, 1)
            #display.show()
            #time.sleep(.4)
            state = 'idle'

    display.show()
    time.sleep(.4)
    

print('out of with')

