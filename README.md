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
