# sensor-pi-js
A simple platform for sensor data visualization on Raspberry Pi and Adafruit Feathers with RFM69 radios. Written in JavaScript as much as possible.

To transfer data from development machine to rpi:
```rsync -zvr --exclude=node_modules sensorjs/ pi@sensor.local:~/sensorjs/```


### Detailed notes I wrote for a former student
Open a terminal and try to run:

```git clone git@github.com:ecostanza/sensor-pi-js.git```

This should create a folder named sensor-pi-js, so get into that folder:

```cd sensor-pi-js```

Then, when the raspberry pi is connected to the same network as your computer (i.e. if you can see the visualization page on the browser), run to copy the Web application code to it:

```rsync -zvr --exclude=node_modules sensorjs/ pi@sensor.local:~/sensorjs/```

You should be asked for a password

Now you need to restart the Web application, for the new code to take effect. 

Assuming the raspberry pi is still connected to the same network as your computer, run the following command:

```ssh pi@sensor.local```

If that worked, you are now on the terminal on the raspberry pi itself. That's what SSH is, essentially a "remote terminal"

To restart the web app, please run:

```sudo systemctl restart sensorjs.service```

to see possible error messages, please run:

```sudo journalctl -f -u sensorjs.service```

From SSH you can also run:

```sudo poweroff```

to turn off the raspberry pi (if you turn it off from the on-device button you should see that SSH is automatically disconnected)
    
To manually edit wifi networks:
```sudo nano /etc/wpa_supplicant/wpa_supplicant.conf```

## Setting up sqlite3 for the annotations db
on the RPi (or also the dev machine):
```
npm install better-sqlite3
```

to create the table to store the annotations run:
```
node create_annotations_table.js
```

## Upgrading Node.js on RPi (PLEASE IGNORE!)

Install NVM:
```
wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash
```

Install node 16:
```
NVM_NODEJS_ORG_MIRROR=https://unofficial-builds.nodejs.org/download/release nvm install 16
```

close the shell and re-open (exit ssh and login again)
then ```node --version``` should show version 16

Make the new version the system default (needed for the services):
```
sudo rm -f /usr/bin/node
sudo rm -f /usr/bin/npm
sudo ln -s $(which node) /usr/bin/
sudo ln -s $(which npm) /usr/bin/
```

Recent node versions do not run on port 80, so we need to map port 3000 to 80
```
sudo iptables -t nat -I PREROUTING -p tcp --dport 80 -j REDIRECT --to-port 3000
```
TODO: add this to systemd for persistence

Reboot the RPi


```
npx prisma generate
npx prisma db push
```

# Firmware

## rfm69pi

The (https://github.com/openenergymonitor/RFM2Pi/blob/master/docs/rfm69pi_v3.md)[RFM69Pi] is a 
board that gets attached to the GPIO pins of the raspberry pi, and it contains an RFM69 radio
and an ATmega328p AVR microcontroller to manage the radio and interface with the RPi via 
the GPIO serial port.

The firmware on these boards needs to be replaced, and it is in the rfm69pi folder. 
While the default firmware on these boards uses the "JeeLib" wireless comm library, 
this project uses the LowPowerLab library. 

To flash the firmware onto the board:

enable the serial port on the raspberry pi using `sudo raspi-config`

install avrdude and minicom:
sudo apt install avrdude
sudo apt install minicom

get avrdude-autoreset from:
https://github.com/SpellFoundry/avrdude-rpi

and install it following the instructions

then change autoreset to use 
`pin = 7 # for the rfm69pi`

the use like:

`sudo avrdude -P /dev/serial0 -b 38400 -p m328p -c arduino -v -U flash:w:rfm69pi.ino.standard.hex`

change the sleep duration to 0.12 or 0.24

<!-- 
TODO: 
- services to be up: serial_receiver_py.service, uploader_py.service, sensorjs.service
- rename receiver_py.service to spi_receiver_py.service and receiver.py to spi_receiver.py

 -->