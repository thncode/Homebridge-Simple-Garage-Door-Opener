'use strict';

const rpio = require('rpio');
const fs = require('fs');

var Service, Characteristic;
var script;

module.exports = (homebridge) => {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;

  homebridge.registerAccessory('homebridge-simple-garage-door-opener', 'SimpleGarageDoorOpener', SimpleGarageDoorOpener);
};

class SimpleGarageDoorOpener {
  constructor (log, config) {

    //get config values
    this.name = config['name'];
    this.doorSwitchPin = config['doorSwitchPin'] || 12;					// PIN 12 = GPIO18
    this.simulateTimeOpening = config['simulateTimeOpening'] || 15;
    this.simulateTimeOpen = config['simulateTimeOpen'] || 30;
    this.simulateTimeClosing = config['simulateTimeClosing'] || 15;

    //initial setup
    this.log = log;
    this.lastOpened = new Date();
    this.service = new Service.GarageDoorOpener(this.name, this.name);
    this.setupGarageDoorOpenerService(this.service);

    this.informationService = new Service.AccessoryInformation();
    this.informationService
      .setCharacteristic(Characteristic.Manufacturer, 'Simple Garage Door')
      .setCharacteristic(Characteristic.Model, 'A Remote Control')
      .setCharacteristic(Characteristic.SerialNumber, '0711');
  }

  getServices () {
    return [this.informationService, this.service];
  }

  setupGarageDoorOpenerService (service) {
  
  	//rpio.open(this.doorSwitchPin, rpio.OUTPUT, rpio.LOW);
  	
  	//if (fs.existsSync('/sys/class/gpio/export')) {
 	//	 this.log('GPIO export 18 done');
	//}
	//else {
	
		const exec = require('child_process').exec;
		script = exec('echo "18" > /sys/class/gpio/export',
			(error, stdout, stderr) => {
				if (error !== null) {
					this.log("exec error: ", error);
				}
			});	
		script = exec('echo "out" > /sys/class/gpio/gpio18/direction',
			(error, stdout, stderr) => {
				if (error !== null) {
					this.log("exec error: ", error);
				}
			});
	//}

    this.service.setCharacteristic(Characteristic.TargetDoorState, Characteristic.TargetDoorState.CLOSED);
    this.service.setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.CLOSED);

    service.getCharacteristic(Characteristic.TargetDoorState)
      .on('get', (callback) => {
        var targetDoorState = service.getCharacteristic(Characteristic.TargetDoorState).value;
        if (targetDoorState === Characteristic.TargetDoorState.OPEN && ((new Date() - this.lastOpened) >= (this.closeAfter * 1000))) {
          this.log('Setting TargetDoorState -> CLOSED');
          callback(null, Characteristic.TargetDoorState.CLOSED);
        } else {
          callback(null, targetDoorState);
        }
      })
      .on('set', (value, callback) => {
        if (value === Characteristic.TargetDoorState.OPEN) {
          this.lastOpened = new Date();
          switch (service.getCharacteristic(Characteristic.CurrentDoorState).value) {
            case Characteristic.CurrentDoorState.CLOSED:
            case Characteristic.CurrentDoorState.CLOSING:
            case Characteristic.CurrentDoorState.OPEN:
              this.openGarageDoor(callback);
              break;
            default:
              callback();
          }
        } else {
          callback();
        }
      });
  }

  openGarageDoor (callback) {
//    rpio.write(this.doorSwitchPin, rpio.HIGH);
//    rpio.sleep(0.5);
//    rpio.write(this.doorSwitchPin, rpio.LOW);

	const exec = require('child_process').exec;
	script = exec('echo "1" > /sys/class/gpio/gpio18/value',
		(error, stdout, stderr) => {
			if (error !== null) {
				this.log("exec error: ", error);
			}
		});	

	script = exec('echo "0" > /sys/class/gpio/gpio18/value',
		(error, stdout, stderr) => {
			if (error !== null) {
				this.log("exec error: ", error);
			}
		});	

    this.log('Öffne die Schranke...');
    this.simulateGarageDoorOpening();
    callback();
  }


  simulateGarageDoorOpening () {
    this.service.setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.OPENING);
    setTimeout(() => {
      this.service.setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.OPEN);
      setTimeout(() => {
        this.service.setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.CLOSING);
        this.service.setCharacteristic(Characteristic.TargetDoorState, Characteristic.TargetDoorState.CLOSED);
        setTimeout(() => {
          this.service.setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.CLOSED);
        }, this.simulateTimeClosing * 1000);
      }, this.simulateTimeOpen * 1000);
    }, this.simulateTimeOpening * 1000);
  }
}
