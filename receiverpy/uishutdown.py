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

import busio
from digitalio import DigitalInOut, Direction, Pull
import board
import adafruit_ssd1306

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

# display.text('It is now OK', 0, 0, 1)
# display.text('to unplug me!', 0, 10, 1)
# display.text('Goodbye..', 0, 20, 1)
display.text('When the green light', 0, 0, 1)
display.text('stays off you can', 0, 10, 1)
display.text('unplug me. Goodbye..', 0, 20, 1)

display.show()


