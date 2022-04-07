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
