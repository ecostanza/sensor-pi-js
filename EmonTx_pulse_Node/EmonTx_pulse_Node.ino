/*
  EmonTx_Node

  Largely based on https://github.com/openenergymonitor/emontx3

*/
// libraries needed for the radio
#include <RFM69.h>              // https://www.github.com/lowpowerlab/rfm69
#include <RFM69_ATC.h>          // https://www.github.com/lowpowerlab/rfm69
#include <avr/sleep.h>
#include <avr/power.h>

//#include <Adafruit_SleepyDog.h> // https://github.com/adafruit/Adafruit_SleepyDog

//#define DEBUG 1
//#define NO_SLEEP 1
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
#define NODEID        114    // The ID of this node (must be different for every node on network)
#define NETWORKID     100  // The network ID

//#define EMON_TX 1

#ifdef EMON_TX
  // Emon_Tx
  #define ADC_PIN 1
  #define VBATPIN 7
  #define LED 6
#else
  // feather
  #define LED LED_BUILTIN
  // this board is the RFM69HW/HCW not the RFM69W/CW
  #define IS_RFM69HW_HCW

  #define ADC_PIN 0

  // on the M0 feather the battery pin is different
  #ifdef __arm__
    #define VBATPIN A7
  #else
    #define VBATPIN A9
  #endif
  
#endif

// The transmision frequency of the baord. Change as needed.
#define FREQUENCY      RF69_433MHZ //RF69_868MHZ // RF69_915MHZ

// TODO: the RF69_IRQ_NUM seems unnecessary
// Board and radio specific config - You should not need to edit
#if defined (__AVR_ATmega32U4__)
    #define RF69_RESET    4
    #define RF69_SPI_CS   8
    #define RF69_IRQ_PIN  7
    #define RF69_IRQ_NUM  4
#elif defined(__arm__)
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


// from open energy monitor
#if defined(__arm__)
  #define ADC_BITS    12
#else
  #define ADC_BITS    10
#endif

#define ADC_COUNTS  (1<<ADC_BITS)

#define SUPPLY_VOLTAGE 3300
// TODO: check burden resistor value 
//#define ICAL 90.9 // (2000 turns / 22 Ohm burden) = 90.9
//#define ICAL 90.9 * 1.125 // (2000 turns / 22 Ohm burden) = 90.9
//#define ICAL 109.29 // (2000 turns / 18.3 Ohm burden) = 109.29
//#define ICAL 109.29 * 1.125 // (2000 turns / 18.3 Ohm burden) = 109.29

//#define N_SAMPLES 1662 // 1662 samples take 300 mS, which equates to 15 cycles @ 50 Hz
//const double I_ratio = ICAL * ((SUPPLY_VOLTAGE / 1000.0) / ADC_COUNTS);

//double offsetValue;
//unsigned int value;
//double filteredValue;
//double sq_value;
//double sum;
//double readings_sum;
//unsigned int curr_readings = 0;
//unsigned int n_readings = 1;
//#define READING_PERIOD 3000
// frequency = N_READINGS * READING_PERIOD 
//#define READING_PERIOD 60000

uint16_t sampling_period = 5;

unsigned long start;

void blink() {
  pinMode(LED, OUTPUT);
  // blink once
  digitalWrite(LED, HIGH);
  delay(500);
  digitalWrite(LED, LOW);
  pinMode(LED, INPUT);
}

#ifdef EMON_TX 
#define PULSE_PIN 3
#else
#define PULSE_PIN 1
#endif

volatile unsigned long pulse_count = 0;
volatile unsigned long pulse_time = 0;
const byte min_pulsewidth= 110;

void onPulse()
{
  if ( (millis() - pulse_time) > min_pulsewidth) {
    pulse_count++;          //calculate Wh elapsed from time between pulses
  }
  pulse_time = millis();  
}


// the setup function runs once when you press reset or power the board
void setup() {
  blink();

  power_twi_disable();
  power_timer1_disable();
  power_timer2_disable();

  // initialize digital pin LED_BUILTIN as an output.
  
  #ifdef DEBUG  
  Serial.begin(115200);
  while (!Serial) delay(10);     // will pause Zero, Leonardo, etc until serial console opens
  #endif
  DEBUG_PRINTLN("hello EmonTx!");

  //pinMode(ADC_PIN, INPUT);
  //offsetValue = ADC_COUNTS >> 1;

  // make the pulse pin an input:
  pinMode(PULSE_PIN, INPUT);
  attachInterrupt(digitalPinToInterrupt(PULSE_PIN), onPulse, FALLING);

  // Initialize the radio
  bool radio_ok = radio.initialize(FREQUENCY, NODEID, NETWORKID);
  // Initialize the radio
#ifdef IS_RFM69HW_HCW
  radio.setHighPower(); //must include this only for RFM69HW/HCW!
#endif

  if (radio_ok) {
    DEBUG_PRINTLN("radio.initialize success");
  } else {
    DEBUG_PRINTLN("radio.initialize failed");
  }
  //radio.spyMode(true);

  blink();
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

void send_data(const double &electricity_consumption, const uint16_t &battery, uint16_t *sampling_period_ptr) {
  
  // send data
  char payload[60] = {0};

  payload[0] = 20; // electricity consumption (double, so it will go into [1-4])
  memcpy(payload+1,(byte *)&electricity_consumption, sizeof(electricity_consumption));
  
  payload[5] = 21; // battery (uint16_t, so it will go into [6-7]
  memcpy(payload+6,(byte *)&battery, sizeof(battery)); 
  
  payload[8] = 24; // sampling_period (uint16_t, so it will go into [9-10]
  memcpy(payload + 9, (byte *)sampling_period_ptr, sizeof(*sampling_period_ptr));
  // we safely still have some room!

  if (radio.receiveDone()) {
    DEBUG_PRINT("received from:"); DEBUG_PRINT(radio.SENDERID);
    DEBUG_PRINT(" to:"); DEBUG_PRINTLN(radio.TARGETID);

    for (int i=0; i<radio.DATALEN;i++) {
      DEBUG_PRINT(radio.DATA[i]);DEBUG_PRINT(":");
    }
    DEBUG_PRINTLN();
    //if (radio.DATA[0] == 
  } else {
    //DEBUG_PRINTLN("[0]");
  }
  
  // TODO: consider sending less frequently and packing more data into packet?
  
  DEBUG_PRINTLN("Sending");
  if (radio.sendWithRetry(1, payload, 11, 3, 200)) {
    DEBUG_PRINT("ACK received from:"); DEBUG_PRINT(radio.SENDERID);
    DEBUG_PRINT(" to:"); DEBUG_PRINTLN(radio.TARGETID);
    for (int i=0; i<radio.DATALEN;i++) {
      DEBUG_PRINT(radio.DATA[i]);DEBUG_PRINT(":");
    }
    //DEBUG_PRINTLN();
    DEBUG_PRINT("datalen: "); DEBUG_PRINTLN(radio.DATALEN);
    //DEBUG_PRINTLN();
    // TODO: get the sampling frequency from the ack data 
    // if it is different from the current one, store it in eeprom
    if(radio.DATA[0] == 24) {
      memcpy((byte *) sampling_period_ptr, radio.DATA + 1, 2);
      DEBUG_PRINT("s.p.: "); DEBUG_PRINTLN(*sampling_period_ptr);
      //n_readings = (int) (*sampling_period_ptr * 1000 / READING_PERIOD);
      //if (n_readings < 1) {
      //  n_readings = 1;
      //}
      //DEBUG_PRINT("n_readings: "); DEBUG_PRINTLN(n_readings);
    } else {
      DEBUG_PRINT("data[0]: "); DEBUG_PRINTLN(radio.DATA[0]);
    }
  } else {
    DEBUG_PRINTLN("No ACK");
  }

  radio.setMode(RF69_MODE_SLEEP);

}

void loop() {
  start = millis();

  unsigned long pulse_out = 0;
  if (pulse_count) {
    cli();
    pulse_out = pulse_count;
    pulse_count = 0;
    sei();  
  }

  DEBUG_PRINT("pulse_out:\t");
  DEBUG_PRINTLN(pulse_out);

  //double I_rms = ((double) pulse_out) / 0.23;
  // double P_kW = ((double) pulse_out) / 1000;
  // double P_kW = ((double) pulse_out) / (1000 * sampling_period / 3600));
  double P_kW = ((double) pulse_out) / (((double)sampling_period) / 3.6);

  //DEBUG_PRINT("I_rms:\t");
  //DEBUG_PRINTLN(I_rms);
  
  uint16_t battery = int(analogRead(VBATPIN));

  //send_data(I_rms, battery, &sampling_period);
  send_data((double) P_kW, battery, &sampling_period);
  
  unsigned long delta = millis() - start;
  DEBUG_PRINTLN(delta);

  #ifdef DEBUG
  Serial.flush();
  Serial.end();
  #endif
  // TODO: change to idle sleep, so timer is available
  // 
  power_adc_disable();

  //int toSleep = READING_PERIOD - delta;
  //int slept = 0;
  while ((millis() - start) < (sampling_period * 1000)) {
    //delay(READING_PERIOD - delta);
    #ifdef NO_SLEEP 
    delay(200);
    //toSleep -= 200;
    #else
    //slept = Watchdog.sleep(toSleep);
    //toSleep -= slept;
    set_sleep_mode(SLEEP_MODE_IDLE);
    sleep_enable();
    sleep_mode();

    sleep_disable();
  
    #endif
  }
  power_adc_enable();
  
  #if defined(DEBUG) && !defined(NO_SLEEP)
  blink();
  // need to reset serial after watchdog sleep
  //USBDevice.init();
  Serial.begin(115200);
  if (!Serial) delay(10);     // will pause Zero, Leonardo, etc until serial console opens
  #endif

}
