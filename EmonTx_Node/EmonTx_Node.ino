/*
  EmonTx_Node

  Largely based on https://github.com/openenergymonitor/emontx3

*/
// libraries needed for the radio
#include <RFM69.h>              // https://www.github.com/lowpowerlab/rfm69
#include <RFM69_ATC.h>          // https://www.github.com/lowpowerlab/rfm69

#include <Adafruit_SleepyDog.h> // https://github.com/adafruit/Adafruit_SleepyDog

//#define DEBUG 1
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
#define NODEID        100    // The ID of this node (must be different for every node on network)
#define NETWORKID     100  // The network ID
//#define NETWORKID     212  // The network ID

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


#define LED 6
#define ADC_PIN 1

const byte VBATPIN = 7;

// from open energy monitor
#if defined(__arm__)
#define ADC_BITS    12
#else
#define ADC_BITS    10
#endif

#define ADC_COUNTS  (1<<ADC_BITS)

#define SUPPLY_VOLTAGE 3300
// TODO: check burden resistor value 
#define ICAL 90.9 // (2000 turns / 22 Ohm burden) = 90.9
#define N_SAMPLES 1662 // 1662 samples take 300 mS, which equates to 15 cycles @ 50 Hz
const double I_ratio = ICAL * ((SUPPLY_VOLTAGE / 1000.0) / ADC_COUNTS);

double offsetValue;
unsigned int value;
double filteredValue;
double sq_value;
double sum;
double readings_sum;
unsigned int curr_readings = 0;
#define N_READINGS 10
#define READING_PERIOD 3000

unsigned long start;

// the setup function runs once when you press reset or power the board
void setup() {
  // initialize digital pin LED_BUILTIN as an output.
  //DDRD |= 0x01 << LED;
  #ifdef DEBUG  
  Serial.begin(115200);
  while (!Serial) delay(10);     // will pause Zero, Leonardo, etc until serial console opens
  #endif
  DEBUG_PRINTLN("hello EmonTx!");

  pinMode(ADC_PIN, INPUT);
  offsetValue = ADC_COUNTS >> 1;

  // Initialize the radio
  bool radio_ok = radio.initialize(FREQUENCY, NODEID, NETWORKID);
  if (radio_ok) {
    DEBUG_PRINTLN("radio.initialize success");
  } else {
    DEBUG_PRINTLN("radio.initialize failed");
  }
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
  20  electricity consumption
  21  battery
 */

void loop() {
  start = millis();
  sum = 0;
  for (int i=0; i < N_SAMPLES; i++) {
    value = analogRead(ADC_PIN);
    offsetValue = offsetValue + ((value-offsetValue) / 1024);
    filteredValue = value - offsetValue;
    sq_value = filteredValue * filteredValue;
    // TODO: filter values that are off?
    sum += sq_value;
  }
  double Irms = I_ratio * sqrt(sum / N_SAMPLES);
  //Serial.println(Irms);
  readings_sum += Irms;
  curr_readings++;

  if (curr_readings == N_READINGS) {
    double avg = readings_sum / N_READINGS;
    DEBUG_PRINT(avg); DEBUG_PRINT("\t");
    readings_sum = 0;
    curr_readings = 0;

    uint16_t battery = int(analogRead(VBATPIN));
    
    // send data
    char payload[60] = {0};
  
    payload[0] = 20; // electricity consumption (double, so it will go into [1-4])
    memcpy(payload+1,(byte *)&avg, sizeof(avg));
    
    payload[5] = 21; // battery (uint16_t, so it will go into [5-6]
    memcpy(payload+6,(byte *)&battery, sizeof(battery)); 
        
    // we safely still have some room!
    // TODO: consider sending less frequently and packing more data into packet?
    
    DEBUG_PRINTLN("Sending");
    if (radio.sendWithRetry(1, payload, 60, 3, 20)) {
      DEBUG_PRINTLN("ACK received");
    } else {
      DEBUG_PRINTLN("No ACK");
    }
  }
  
  DEBUG_PRINT(Irms); DEBUG_PRINT("\t");

  unsigned long delta = millis() - start;
  DEBUG_PRINTLN(delta);

  #ifdef DEBUG
  Serial.end();
  #endif
  
  // sleep with Watchdog to save battery
  //delay(30000);
  //Watchdog.sleep(30000);
  int toSleep = READING_PERIOD - delta;
  if (toSleep > 0) {
    //delay(READING_PERIOD - delta);
    int slept = Watchdog.sleep(toSleep);
    toSleep -= slept;
  }
  
  #ifdef DEBUG
  // need to reset serial after watchdog sleep
  Serial.begin(115200);
  #endif

}
