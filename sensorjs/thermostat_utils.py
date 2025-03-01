# coding: utf-8

import requests
import json
import logging

from private import ZWAY_UNAME, ZWAY_PASS, AUTH_URL, THERMOSTAT_URL

def auth():
    s = requests.Session()
    
    auth_data = json.dumps({"form": "true", 
                               "login": ZWAY_UNAME, 
                               "password": ZWAY_PASS, 
                               "keepme": "false", 
                               "default_ui": "1"})
    auth_headers = {
               "Accept": "application/json", 
               "Content-Type": "application/json"
               }
    
    r = s.post(AUTH_URL,
               data = auth_data,
               headers = auth_headers)
    
    #print r.status_code
    #print r.text
    #print
    # logger.debug('auth response status code: %d' % r.status_code)
    # if r.status_code != 200:
    #     logger.warning('auth response: ' + r.text)
    
    return s

def switch_on():
    # check it is not alredy ON
    s = auth()
    status_r = s.get(THERMOSTAT_URL)
    status_j = status_r.json()
    if status_j['data']['metrics']['level'] != 'on':
        on_url = THERMOSTAT_URL + '/command/on'
        r = s.get(on_url)
        return r.text
    else:
        return 'already ON'

def switch_off():
    # check it is not alredy OFF
    s = auth()
    status_r = s.get(THERMOSTAT_URL)
    status_j = status_r.json()
    if status_j['data']['metrics']['level'] == 'on':
        off_url = THERMOSTAT_URL + '/command/off'
        r = s.get(off_url)
        return r.text
    else:
        return 'already OFF'

def get_status():
    s = auth()
    status_url = 'http://zway.local:8083/ZAutomation/api/v1/devices/ZWayVDev_zway_7-0-64'
    r = s.get(status_url)
    # parse the response as json
    j = r.json()
    # print 
    logging.info(json.dumps(j, indent=2))
    return r

if __name__ == '__main__':
    import sys
    if '-v' in sys.argv:
        logging.basicConfig(level=logging.INFO)
    if '-vv' in sys.argv:
        logging.basicConfig(level=logging.DEBUG)

    # switch_on()
    # switch_off()
    get_status()

