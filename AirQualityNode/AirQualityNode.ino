/***************************************************************

   Read data from Adafruit SCD30 (CO2) PM2.5 (PM), and SGP30
   and send them via RFM69
   based on Adafruit examples and Jacob's RFM69 example

   This file is part of sensor-pi-js (https://github.com/ecostanza/sensor-pi-js).
   Copyright (c) 2021 Enrico Costanza.

   This program is free software: you can redistribute it and/or modify
   it under the terms of the GNU General Public License as published by
   the Free Software Foundation, version 3.

   This program is distributed in the hope that it will be useful, but
   WITHOUT ANY WARRANTY; without even the implied warranty of
   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
   General Public License for more details.

   You should have received a copy of the GNU General Public License
   along with this program. If not, see <http://www.gnu.org/licenses/>.

 ***************************************************************/

// libraries needed for the three sensors
#include <Adafruit_SCD30.h>
#include "Adafruit_PM25AQI.h"
#include <Wire.h>
#include "Adafruit_SGP30.h"


// libraries needed for the radio
#include <RFM69.h>              // https://www.github.com/lowpowerlab/rfm69
#include <RFM69_ATC.h>          // https://www.github.com/lowpowerlab/rfm69
#include <SPI.h>                // Included with Arduino IDE
#include <Adafruit_SleepyDog.h> // https://github.com/adafruit/Adafruit_SleepyDog

#define DEBUG 1
// based on https://forum.arduino.cc/t/serial-debug-macro/64259/3
#ifdef DEBUG
#define DEBUG_PRINT(...) Serial.print(__VA_ARGS__)
#define DEBUG_PRINTLN(...) Serial.println(__VA_ARGS__)
#else
#define DEBUG_PRINT(...)
#define DEBUG_PRINTLN(...)
#endif


// Radio node and network config
//#define NODEID        3    // The ID of this node (must be different for every node on network)
#define NETWORKID     100  // The network ID
//#define NETWORKID     212  // The network ID

// The transmision frequency of the baord. Change as needed.
#define FREQUENCY      RF69_433MHZ //RF69_868MHZ // RF69_915MHZ

// Uncomment if this board is the RFM69HW/HCW not the RFM69W/CW
#define IS_RFM69HW_HCW

// Board and radio specific config - You should not need to edit
#if defined (__AVR_ATmega32U4__) && defined (USING_RFM69_WING)
#define RF69_SPI_CS  10
#define RF69_RESET   11
#define RF69_IRQ_PIN 2
#define RF69_IRQ_NUM digitalPinToInterrupt(RF69_IRQ_PIN)
#elif defined (__AVR_ATmega32U4__)
#define RF69_RESET    4
#define RF69_SPI_CS   8
#define RF69_IRQ_PIN  7
#define RF69_IRQ_NUM  4
#define RF69_IRQ_NUM digitalPinToInterrupt(RF69_IRQ_PIN)
#elif defined(ARDUINO_SAMD_FEATHER_M0) && defined (USING_RFM69_WING)
#define RF69_RESET    11
#define RF69_SPI_CS   10
#define RF69_IRQ_PIN  6
#define RF69_IRQ_NUM  digitalPinToInterrupt(RF69_IRQ_PIN)
#elif defined(ARDUINO_SAMD_FEATHER_M0)
#define RF69_RESET    4
#define RF69_SPI_CS   8
#define RF69_IRQ_PIN  3
#define RF69_IRQ_NUM  3
#define RF69_IRQ_NUM digitalPinToInterrupt(RF69_IRQ_PIN)
#endif

// radio object
RFM69 radio(RF69_SPI_CS, RF69_IRQ_PIN, false, RF69_IRQ_NUM);

// sensor objects
Adafruit_SCD30  scd30;
Adafruit_PM25AQI aqi = Adafruit_PM25AQI();
Adafruit_SGP30 sgp;

// Reset the Radio
void resetRadio() {
  DEBUG_PRINTLN("Resetting radio...");
  pinMode(RF69_RESET, OUTPUT);
  digitalWrite(RF69_RESET, HIGH);
  delay(20);
  digitalWrite(RF69_RESET, LOW);
  delay(500);
}

/* return absolute humidity [mg/m^3] with approximation formula
  @param temperature [°C]
  @param humidity [%RH]
*/
uint32_t getAbsoluteHumidity(float temperature, float humidity) {
  // approximation formula from Sensirion SGP30 Driver Integration chapter 3.15
  const float absoluteHumidity = 216.7f * ((humidity / 100.0f) * 6.112f * exp((17.62f * temperature) / (243.12f + temperature)) / (273.15f + temperature)); // [g/m^3]
  const uint32_t absoluteHumidityScaled = static_cast<uint32_t>(1000.0f * absoluteHumidity); // [mg/m^3]
  return absoluteHumidityScaled;
}


void setup(void) {
  Watchdog.disable();
#ifdef DEBUG
  Serial.begin(115200);
  //while (!Serial) delay(10);     // will pause Zero, Leonardo, etc until serial console opens
  if (!Serial) delay(5000);     // will pause Zero, Leonardo, etc until serial console opens
#endif

  DEBUG_PRINTLN("Air Quality Sensor Node.");

  int node_id = 2;
  //// SGP setup
  if (! sgp.begin()) {
    DEBUG_PRINTLN("SGP30 not found - stuck :(");
    while (1) {
      delay(1000);
    }
  } else {
    DEBUG_PRINTLN("SGP30 Found; Serial #");
    DEBUG_PRINTLN(sgp.serialnumber[0], HEX);
    DEBUG_PRINTLN(sgp.serialnumber[1], HEX);
    DEBUG_PRINTLN(sgp.serialnumber[2], HEX);
    if ( sgp.serialnumber[0] == 0 && sgp.serialnumber[1] == 0x154 && sgp.serialnumber[2] == 0x5013 ) {
      DEBUG_PRINTLN("node id: 3");
      // node 3
      node_id = 3;
      sgp.setIAQBaseline(34517, 37845);
    } else if ( sgp.serialnumber[0] == 0 && sgp.serialnumber[1] == 0x18C && sgp.serialnumber[2] == 0xCB3B ) {
      DEBUG_PRINTLN("node id: 2");
      // node 2
      node_id = 2;
      sgp.setIAQBaseline(34516, 36413);
    } else {
      DEBUG_PRINTLN("Unrecognized SGP30 device - stuck :(");
      while (1) {
        delay(1000);
      }
    }
    // If you have a baseline measurement from before you can assign it to start, to 'self-calibrate'
    //sgp.setIAQBaseline(0x8E68, 0x8F41);  // Will vary for each sensor!
    // set the baseline
    // uint16 x3
    // Serial # 0 154 5013 - node 3
    //
  }

  // Reset the radio
  resetRadio();
  // Initialize the radio
  radio.initialize(FREQUENCY, node_id, NETWORKID);
  radio.spyMode(true);
#ifdef IS_RFM69HW_HCW
  radio.setHighPower(); //must include this only for RFM69HW/HCW!
#endif


  // TODO: turn off the ADC to save power


  // Wait one second for PM sensor to boot up
  delay(1000);

  if (! aqi.begin_I2C()) {      // connect to the PM sensor over I2C
    DEBUG_PRINTLN("Could not find the PM 2.5 sensor.");
    while (1) delay(10);
  }

  DEBUG_PRINTLN("PM25 found.");

  // Try to initialize the CO2 sensor!
  if (!scd30.begin()) {
    DEBUG_PRINTLN("Could not find the SCD30 CO2 sensor.");
    //    while (1) { delay(10); }
  } else {
    DEBUG_PRINTLN("SCD30 Found,");
  }

  if (!scd30.setMeasurementInterval(30)) {
    DEBUG_PRINTLN("Failed to set measurement interval");
    //    while(1){ delay(10);}
  } else {
    DEBUG_PRINT("Measurement Interval: ");
    DEBUG_PRINT(scd30.getMeasurementInterval());
    DEBUG_PRINTLN(" seconds");
    scd30.selfCalibrationEnabled(false);
  }

}

/* ****
    Sensor codes
  0  no data
  1 temperature // float!
  2 humidity // float!
  3 CO2 // float!
  4 pm10_standard
  5 pm25_standard
  6 pm100_standard
  7 pm10_env
  8 pm25_env
  9 pm100_env
  10  particles_03um
  11  particles_05um
  12  particles_10um
  13  particles_25um
  14  particles_50um
  15  particles_100um
  16  TVOC
  17  eCO2
  18  rawH2
  19  rawEthanol
  21  battery
  22  eCO2_base
  23  TVOC_base
*/

#define VBATPIN A9


void loop() {
  static uint8_t counter = 0;

  uint8_t data_received = false;
  if (Serial.available() > 0) {
    data_received = true;
    DEBUG_PRINT("Serial received: ");
    while (Serial.available() > 0) {
      char incomingByte = Serial.read();
      DEBUG_PRINT(incomingByte);
    }
    DEBUG_PRINTLN();
  }

  if (data_received) {
    DEBUG_PRINTLN("something was received over serial..");
    // TODO: calibrate CO2 sensor
    scd30.forceRecalibrationWithReference(400);
  }

  uint16_t TVOC_base, eCO2_base;
  if (scd30.dataReady()) {
    //DEBUG_PRINTLN("CO2 Data available.");

    if (!scd30.read()) {
      DEBUG_PRINTLN("Error reading CO2 sensor data");
      delay(500);
    }

    //*
    DEBUG_PRINT("T: "); DEBUG_PRINT(scd30.temperature); DEBUG_PRINT(" degrees C\t");
    DEBUG_PRINT("H: "); DEBUG_PRINT(scd30.relative_humidity); DEBUG_PRINT(" %");
    DEBUG_PRINT("CO2: "); DEBUG_PRINT(scd30.CO2, 3); DEBUG_PRINT(" ppm"); DEBUG_PRINTLN("");
    // */
  } else {
    //DEBUG_PRINTLN("No data");
  }

  PM25_AQI_Data data;

  // TODO: enable and disable the PM sensor via pin to save power

  if (! aqi.read(&data)) {
    DEBUG_PRINTLN("Could not read from AQI");
    delay(500);  // try again in a bit!
    return;
  }

  //*
  DEBUG_PRINT(F("s | PM 1.0: ")); DEBUG_PRINT(data.pm10_standard);
  DEBUG_PRINT(F("\t\tPM 2.5: ")); DEBUG_PRINT(data.pm25_standard);
  DEBUG_PRINT(F("\t\tPM 10: ")); DEBUG_PRINTLN(data.pm100_standard);
  DEBUG_PRINT(F("e | PM 1.0: ")); DEBUG_PRINT(data.pm10_env);
  DEBUG_PRINT(F("\t\tPM 2.5: ")); DEBUG_PRINT(data.pm25_env);
  DEBUG_PRINT(F("\t\tPM 10: ")); DEBUG_PRINTLN(data.pm100_env);
  DEBUG_PRINT(F("> 0.3um: ")); DEBUG_PRINT(data.particles_03um);
  DEBUG_PRINT(F("\t> 0.5um: ")); DEBUG_PRINT(data.particles_05um);
  DEBUG_PRINT(F("\t> 1.0um: ")); DEBUG_PRINT(data.particles_10um);
  DEBUG_PRINT(F("\t> 2.5um: ")); DEBUG_PRINT(data.particles_25um);
  DEBUG_PRINT(F("\t> 5.0um: ")); DEBUG_PRINT(data.particles_50um);
  DEBUG_PRINT(F("\t> 10 um: ")); DEBUG_PRINTLN(data.particles_100um);
  //DEBUG_PRINTLN(F("---------------------------------------"));
  // */

  sgp.setHumidity(getAbsoluteHumidity(scd30.temperature, scd30.relative_humidity));
  if (! sgp.IAQmeasure()) {
    DEBUG_PRINTLN("Measurement failed");
  } else {
    DEBUG_PRINT("TVOC "); DEBUG_PRINT(sgp.TVOC); DEBUG_PRINT(" ppb\t");
    DEBUG_PRINT("eCO2 "); DEBUG_PRINT(sgp.eCO2); DEBUG_PRINTLN(" ppm");
  }

  if (! sgp.IAQmeasureRaw()) {
    DEBUG_PRINTLN("Raw Measurement failed");
  } else {
    DEBUG_PRINT("Raw H2 "); DEBUG_PRINT(sgp.rawH2); DEBUG_PRINT(" \t");
    DEBUG_PRINT("Raw Ethanol "); DEBUG_PRINT(sgp.rawEthanol); DEBUG_PRINTLN("");
  }

  // Send
  DEBUG_PRINTLN("Sending");
  char payload[60] = {0};

  payload[0] = 1; // temperature (float, so it will go into [1-4])
  memcpy(payload + 1, (byte *)&scd30.temperature, sizeof(scd30.temperature));

  payload[5] = 2; // relative_humidity (float, so it will go into [6-9])
  memcpy(payload + 6, (byte *)&scd30.relative_humidity, sizeof(scd30.relative_humidity));

  payload[10] = 3; // CO2 (float, so it will go into [11-14])
  memcpy(payload + 11, (byte *)&scd30.CO2, sizeof(scd30.CO2));

  /*

    4 pm10_standard
    5 pm25_standard
    6 pm100_standard
    7 pm10_env
    8 pm25_env
    9 pm100_env
    10  particles_03um
    11  particles_05um
    12  particles_10um
    13  particles_25um
    14  particles_50um
    15  particles_100um
    21  battery
  */
  payload[15] = 4; // pm10_standard (uint16_t, so it will go into [16-17]
  memcpy(payload + 16, (byte *)&data.pm10_standard, sizeof(data.pm10_standard));

  payload[18] = 5; // pm25_standard (uint16_t, so it will go into [19-20]
  memcpy(payload + 19, (byte *)&data.pm25_standard, sizeof(data.pm25_standard));

  payload[21] = 6; // pm100_standard (uint16_t, so it will go into [22-23]
  memcpy(payload + 22, (byte *)&data.pm100_standard, sizeof(data.pm100_standard));

  payload[24] = 7; // pm10_env (uint16_t, so it will go into [25-26]
  memcpy(payload + 25, (byte *)&data.pm10_env, sizeof(data.pm10_env));

  payload[27] = 8; // pm25_env (uint16_t, so it will go into [28-29]
  memcpy(payload + 28, (byte *)&data.pm25_env, sizeof(data.pm25_env));

  payload[30] = 9; // pm100_env (uint16_t, so it will go into [31-32]
  memcpy(payload + 31, (byte *)&data.pm100_env, sizeof(data.pm100_env));

  // SGP30 data
  payload[33] = 16; // TVOC (uint16_t, so it will go into [34-35]
  memcpy(payload + 34, (byte *)&sgp.TVOC, sizeof(sgp.TVOC));

  payload[36] = 17; // eCO2 (uint16_t, so it will go into [37-38]
  memcpy(payload + 37, (byte *)&sgp.eCO2, sizeof(sgp.eCO2));

  payload[39] = 18; // rawH2 (uint16_t, so it will go into [40-41]
  memcpy(payload + 40, (byte *)&sgp.rawH2, sizeof(sgp.rawH2));

  payload[42] = 19; // rawEthanol (uint16_t, so it will go into [43-44]
  memcpy(payload + 43, (byte *)&sgp.rawEthanol, sizeof(sgp.rawEthanol));

  //unsigned int battery = analogRead(VBATPIN);
  uint16_t battery = analogRead(VBATPIN);
  //  measuredvbat *= 2;    // we divided by 2, so multiply back
  //  measuredvbat *= 3.3;  // Multiply by 3.3V, our reference voltage
  //  measuredvbat /= 1024; // convert to voltage

  payload[45] = 21; // battery (uint16_t, so it will go into [46-47]
  memcpy(payload + 46, (byte *)&battery, sizeof(battery));

  //
  if (counter >= 10) {
    counter = 0;
    sgp.getIAQBaseline(&eCO2_base, &TVOC_base);

    DEBUG_PRINT("baseline TVOC "); DEBUG_PRINT(TVOC_base); DEBUG_PRINT(" ppb\t");
    DEBUG_PRINT("baseline eCO2 "); DEBUG_PRINT(eCO2_base); DEBUG_PRINTLN(" ppm");

    payload[48] = 22; // eCO2_base (uint16_t, so it will go into [49-50]
    memcpy(payload + 49, (byte *)&eCO2_base, sizeof(eCO2_base));

    payload[51] = 23; // TVOC_base (uint16_t, so it will go into [52-53]
    memcpy(payload + 52, (byte *)&TVOC_base, sizeof(TVOC_base));
  }
  counter++;


  // we safely still have some room!

  if (radio.sendWithRetry(1, payload, 60, 3, 200)) {
    DEBUG_PRINTLN("ACK received\n\n");
  } else {
    DEBUG_PRINTLN("No ACK\n\n");
  }

  // TODO: sleep instead, possibly Watchdog.sleep()
#ifdef DEBUG
  delay(30000);
#else
  // battery lasts about 9h with delay
  //delay(30000);
  // TODO: Measure battery duration with sleep
  int sleepMS = 0;
  while (sleepMS < 30000) {
    sleepMS += Watchdog.sleep(30000 - sleepMS);
  }
#endif
}
