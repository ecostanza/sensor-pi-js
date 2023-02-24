/***************************************************************
 * 
 * Receive data from RFM69 and send it to serial
 * 
 ***************************************************************/

// libraries needed for the sensor
//#include "Adafruit_Si7021.h"

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


#define NODEID        1    
#define NETWORKID     100  // The network ID
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

#define RF69_RESET    4
#define RF69_SPI_CS   10
#define RF69_IRQ_PIN  2
#define RF69_IRQ_NUM  4

// radio object
RFM69 radio(RF69_SPI_CS, RF69_IRQ_PIN, false, RF69_IRQ_NUM);

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

#define MAX_NODES 120
uint16_t sampling_periods[MAX_NODES] = {0};

void setup(void) {
//  #ifdef DEBUG
//  Serial.begin(115200);
  Serial.begin(38400);
  while (!Serial) delay(10);     // will pause Zero, Leonardo, etc until serial console opens
//  #endif
  
  DEBUG_PRINTLN("RFM69pi.");

  bool radio_ok = radio.initialize(FREQUENCY, node_id, NETWORKID);
  if (radio_ok) {
    DEBUG_PRINTLN("radio.initialize success");
  } else {
    DEBUG_PRINTLN("radio.initialize failed");
  }
  radio.spyMode(false);
//  #ifdef IS_RFM69HW_HCW
//    radio.setHighPower(); //must include this only for RFM69HW/HCW!
//  #endif

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
  24  sampling_period // ushort
 */

byte ackCount=0;
//uint32_t packetCount = 0;

void loop() {
//  DEBUG_PRINTLN("loop");

  if (radio.receiveDone()) {
    Serial.print('[');Serial.print(radio.SENDERID, DEC);Serial.print("] ");
    Serial.print("to [");Serial.print(radio.TARGETID, DEC);Serial.print("] ");
    for (byte i = 0; i < radio.DATALEN; i++) {
      if (radio.DATA[i] < 16) {
        Serial.print("0");
      }
      Serial.print(radio.DATA[i], HEX);
      //Serial.print(" ");
      //Serial.print(radio.DATA[i], DEC);
      //Serial.print(" ");
    }
    Serial.print("   [RX_RSSI:");Serial.print(radio.RSSI);Serial.print("]");

    // TODO: remove false!
    //if (radio.ACKRequested() && false)
    if (radio.ACKRequested())
    {
      byte theNodeID = radio.SENDERID;
      // TODO: send sampling frequency back, based on the node id
      // sampling frequency in seconds, using 2 bytes
      // could also send the id?
      uint16_t sp = 0;
      if (radio.SENDERID < MAX_NODES) {
        sp = sampling_periods[radio.SENDERID];
      }
      if (sp > 0) {
        byte ack_buffer[4] = {0};
        ack_buffer[0] = 24;
        memcpy(ack_buffer+1, (byte *) &sp, 2);
        radio.sendACK(ack_buffer, 4);
      } else {
        radio.sendACK();
      }
      //Serial.print(" - ACK sent.");
    }
    Serial.println();
  }

  // TODO: listen to serial and store data about node sampling frequency
  // could store just one or few nodes at the time? (to save memory, is that needed?)
  // just use a flat array? [id1] [freq_upper_byte] [freq_lower_byte] [id2] [freq_upper_byte] [freq_lower_byte] ...
  // or use a sparse array? [id1] -> freq, 
  // the serial protocol is
  // [id][sp1][sp2][255][255][255]
  if (Serial.available() >= 6) {
    byte buff[6] = {0};
    for (int i=0; i<6; i++) {
      buff[i] = Serial.read();
      //Serial.print((uint8_t)buff[i]); Serial.print(":");
    }
    //Serial.println();
    
    byte id = buff[0];
    uint16_t sp = 0;
    memcpy((byte *)&sp, buff+1, 2);

    if (id < MAX_NODES) {
      sampling_periods[id] = sp;
    }
  }
  
//  int toSleep = 3000;
//  while (toSleep > 0) {
//    int slept = delay(toSleep);
//    toSleep -= slept;
//  }
  
}
