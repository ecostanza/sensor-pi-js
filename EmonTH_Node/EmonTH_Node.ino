/***************************************************************
 * 
 * Read data from Adafruit SCD30 (CO2) and Adafruit PM2.5 (PM) 
 * and send them via RFM69
 * based on Adafruit examples and Jacob's RFM69 example
 * 
 ***************************************************************/

// libraries needed for the sensor
#include "Adafruit_Si7021.h"

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
//#define NODEID        101    // The ID of this node (must be different for every node on network)
#define NODEID        108    // The ID of this node (must be different for every node on network)
#define NETWORKID     100  // The network ID
//#define NETWORKID     212  // The network ID
const int node_id = NODEID;

// The transmision frequency of the baord. Change as needed.
#define FREQUENCY      RF69_433MHZ //RF69_868MHZ // RF69_915MHZ

// Uncomment if this board is the RFM69HW/HCW not the RFM69W/CW
//#define IS_RFM69HW_HCW

// TODO: the RF69_IRQ_NUM seems unnecessary
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
#elif defined(ARDUINO_AVR_UNO)
    #define RF69_RESET    4
    #define RF69_SPI_CS   10
    #define RF69_IRQ_PIN  2
    #define RF69_IRQ_NUM  4
#endif


// radio object
RFM69 radio(RF69_SPI_CS, RF69_IRQ_PIN, false, RF69_IRQ_NUM);

// sensor objects 
Adafruit_Si7021 th_sensor = Adafruit_Si7021();
bool enableHeater = false;

const byte VBATPIN=       1;
#define LED 1

const byte DHT22_PWR=       6;                                      // Not used in emonTH V2.0, 10K resistor R1 connects DHT22 pins
const byte DHT22_DATA=      16;                                     // Not used in emonTH V2.0, 10K resistor R1 connects DHT22 pins.

const byte DS18B20_PWR=    5;

//const byte DIP_switch1=    7;
//const byte DIP_switch2=    8;

// Reset the Radio
void resetRadio() {
  DEBUG_PRINT("Resetting radio...");
  pinMode(RF69_RESET, OUTPUT);
  digitalWrite(RF69_RESET, HIGH);
  delay(20);
  digitalWrite(RF69_RESET, LOW);
  delay(500);

  // verify chip is syncing?
  //start = time.time()
  #ifndef REG_SYNCVALUE1
  #define REG_SYNCVALUE1 0x2F
  #endif
  unsigned long start = millis();
  while( radio.readReg(REG_SYNCVALUE1) != 0xAA ) {
    radio.writeReg(REG_SYNCVALUE1, 0xAA);
    unsigned long currentMillis = millis();
    if (currentMillis - start > 15000) {
      DEBUG_PRINTLN("Failed to sync with radio :-(");
      while (true) ;
    }
  //    if time.time() - start > 15000:
  //        raise Exception('')  
  }
}


void setup(void) {
  #ifdef DEBUG
  Serial.begin(9600);
  while (!Serial) delay(10);     // will pause Zero, Leonardo, etc until serial console opens
  #endif
  
  DEBUG_PRINTLN("Emon TH Sensor Node.");

  //READ DIP SWITCH POSITIONS - LOW when switched on (default off - pulled up high)
//  pinMode(DIP_switch1, INPUT_PULLUP);
//  pinMode(DIP_switch2, INPUT_PULLUP);
//  boolean DIP1 = digitalRead(DIP_switch1);
//  boolean DIP2 = digitalRead(DIP_switch2);
  
  pinMode(VBATPIN, INPUT);

  if (!th_sensor.begin()) {
    DEBUG_PRINTLN("Did not find Si7021 sensor!");
    PORTB |= 0x01 << LED;
    while (true)
      ;
  }
  th_sensor.heater(false);

//  int node_id = NODEID;
  //if ((DIP1 == HIGH) && (DIP2 == HIGH)){ nodeID=nodeID; }
//  if ((DIP1 == LOW ) && (DIP2 == HIGH)){ node_id = node_id+1; }
//  if ((DIP1 == HIGH) && (DIP2 == LOW )){ node_id = node_id+2; }
//  if ((DIP1 == LOW ) && (DIP2 == LOW )){ node_id = node_id+3; }

  // Reset the radio
  //resetRadio();
  // Initialize the radio
  bool radio_ok = radio.initialize(FREQUENCY, node_id, NETWORKID);
  if (radio_ok) {
    DEBUG_PRINTLN("radio.initialize success");
  } else {
    DEBUG_PRINTLN("radio.initialize failed");
  }
//  radio.spyMode(true);
//  #ifdef IS_RFM69HW_HCW
//    radio.setHighPower(); //must include this only for RFM69HW/HCW!
//  #endif

  // Unused pins configure as input pull up for low power
  // http://electronics.stackexchange.com/questions/43460/how-should-unused-i-o-pins-be-configured-on-atmega328p-for-lowest-power-consumpt
  // port map: https://github.com/openenergymonitor/emonth2/blob/master/hardware/readme.md
//  pinMode(DHT22_PWR, INPUT_PULLUP);                                  //DHT22 not used on emonTH V2.
//  pinMode(DHT22_DATA, INPUT_PULLUP);                                 //DHT22 not used on emonTH V2
//  pinMode(14, INPUT_PULLUP);
//  pinMode(20, INPUT_PULLUP);
//  pinMode(21, INPUT_PULLUP);
//  pinMode(4, INPUT_PULLUP);
//  pinMode(DS18B20_PWR,INPUT_PULLUP);

}

/* ****
 *  Sensor codes
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
  21  battery
 */

void loop() {
  DEBUG_PRINTLN("loop");
  float humidity = th_sensor.readHumidity();
  float temperature= th_sensor.readTemperature();
  uint16_t battery = int(analogRead(VBATPIN));

  DEBUG_PRINT("T: ");
  DEBUG_PRINT(temperature, 2);
  DEBUG_PRINT(" degrees C\t");
  
  DEBUG_PRINT("H: ");
  DEBUG_PRINT(humidity, 2);
  DEBUG_PRINT(" %");
  
  DEBUG_PRINT("batt: ");
  DEBUG_PRINT(battery);
  DEBUG_PRINTLN("");
  
  // Send
  DEBUG_PRINTLN("preparing payload");
  char payload[60] = {0};

  payload[0] = 1; // temperature (float, so it will go into [1-4])
  memcpy(payload+1,(byte *)&temperature, sizeof(temperature)); 
  
  payload[5] = 2; // relative_humidity (float, so it will go into [6-9])
  memcpy(payload+6,(byte *)&humidity, sizeof(humidity)); 
  
  payload[10] = 21; // battery (uint16_t, so it will go into [11-12]
  memcpy(payload+11,(byte *)&battery, sizeof(battery));
  
  // we safely still have some room!
  // TODO: consider sending less frequently and packing more data into packet?
  
  DEBUG_PRINTLN("Sending");
  if (radio.sendWithRetry(1, payload, 60, 3, 200)) {
    DEBUG_PRINTLN("ACK received");
  } else {
    DEBUG_PRINTLN("No ACK");
  }

  #ifdef DEBUG
  Serial.end();
  #endif
  
  // sleep with Watchdog to save battery
  //delay(30000);
//  Watchdog.sleep(30000);
  // TODO: test the following and replace if it works
  int toSleep = 30000;
  while (toSleep > 0) {
    int slept = Watchdog.sleep(toSleep);
    toSleep -= slept;
  }
  

  
  #ifdef DEBUG
  // need to reset serial after watchdog sleep
  Serial.begin(9600);
  #endif

}
