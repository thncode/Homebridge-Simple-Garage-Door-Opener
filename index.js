'use strict';

const rpio = require('rpio');

var Service, Characteristic;

module.exports = (homebridge) => {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;

  homebridge.registerAccessory('homebridge-simple-garage-door-opener', 'SimpleGarageDoorOpener', SimpleGarageDoorOpener);
};

class SimpleGarageDoorOpener {
  constructor (log, config) {

    //get config values
    this.name = config['name'];
    this.doorSwitchPinSet = config['doorSwitchPinSet'] || 11;
    this.doorSwitchPinReset = config['doorSwitchPinReset'] || 12;
    this.simulateTimeOpening = config['simulateTimeOpening'] || 5;
    this.simulateTimeOpen = config['simulateTimeOpen'] || 30;
    this.simulateTimeClosing = config['simulateTimeClosing'] || 5;

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
    rpio.open(this.doorSwitchPinSet, rpio.OUTPUT, rpio.LOW);
    this.log('GPIO Reset...');
    rpio.write(this.doorSwitchPinReset, rpio.HIGH);
    rpio.sleep(0.5);
    rpio.open(this.doorSwitchPinReset, rpio.OUTPUT, rpio.LOW);

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
    rpio.write(this.doorSwitchPinReset, rpio.LOW);
    rpio.sleep(0.1);

    rpio.write(this.doorSwitchPinSet, rpio.HIGH);
    rpio.sleep(0.5);
    rpio.write(this.doorSwitchPinSet, rpio.LOW);

    rpio.sleep(0.1);
    rpio.write(this.doorSwitchPinReset, rpio.HIGH);
    rpio.sleep(0.4);
    rpio.write(this.doorSwitchPinReset, rpio.LOW);

    this.log('Opening the barrier gate for...');
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
