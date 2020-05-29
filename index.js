"use strict";

const request = require("request");
let Service, Characteristic;

// Wrap request with a promise to make it awaitable
function doRequest(options) {
  return new Promise(function (resolve, reject) {
    request(options, function (error, res, body) {
      if (!error && res.statusCode === 200) {
        resolve(body);
      } else {
        reject(error);
      }
    });
  });
}

module.exports = function (homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory("homebridge-meross-light", "Meross", Meross);
};

class Meross {
  constructor(log, config) {
    /*
     * The constructor function is called when the plugin is registered.
     * log is a function that can be used to log output to the homebridge console
     * config is an object that contains the config for this plugin that was defined the homebridge config.json
     */

    /* assign both log and config to properties on 'this' class so we can use them in other methods */
    this.log = log;
    this.config = config;

    this.bri = 0;
    this.tmp = 0;
    this.rgb = 0;
    this.hue = 0;

    /*
     * A HomeKit accessory can have many "services". This will create our base service,
     * Service types are defined in this code: https://github.com/KhaosT/HAP-NodeJS/blob/master/lib/gen/HomeKitTypes.js
     * Search for "* Service" to tab through each available service type.
     * Take note of the available "Required" and "Optional" Characteristics for the service you are creating
     */

    /* To be used later
     switch (config.model) {
      case "MSS110-1":
      case "MSS110-2":
      case "MSS210":
      case "MSS310":
      case "MSS420F":
      case "MSS425":
      case "MSS425E":
      case "MSS425F":
      case "MSS620":
        this.service = new Service.Outlet(this.config.name);
        break;
      case "MSS510":
      case "MSS510M":
      case "MSS550":
      case "MSS560":
      case "MSS570":
      case "MSS5X0":
        this.service = new Service.Switch(this.config.name);
        break;
      case "MSG100":
        this.service = new Service.GarageDoorOpener(this.config.name);
        break;
      case "MSL100":
      case "MSL120":
      case "MSL420":
        this.service = new Service.Lightbulb(this.config.name);
        break;
      case "MTS100":
      case "MTS100H":
        this.service = new Service.Thermostat(this.config.name);
        break;
      case "MS100":
      case "MS100H":
        this.service = new Service.TemperatureSensor(this.config.name);
        break;
      case "MSXH0":
        this.service = new Service.HumidifierDehumidifier(this.config.name);
        break;
      case "MRS110":
        this.service = new Service.WindowCovering(this.config.name);
        break;
      default:
        this.service = new Service.Outlet(this.config.name);
    }
     */
    this.service = new Service.Lightbulb(this.config.name);
    this.log('Created new lightbulb: ' + this.config.model);
    this.log('Name of the bulb:      ' + this.config.name);
    this.log('Bulb address:          ' + this.config.deviceUrl)

  }

  getServices() {
    /*
     * The getServices function is called by Homebridge and should return an array of Services this accessory is exposing.
     * It is also where we bootstrap the plugin to tell Homebridge which function to use for which action.
     */

    /* Create a new information service. This just tells HomeKit about our accessory. */
    const informationService = new Service.AccessoryInformation()
      .setCharacteristic(Characteristic.Manufacturer, "Meross")
      .setCharacteristic(Characteristic.Model, this.config.model)
      .setCharacteristic(Characteristic.SerialNumber, "123");

    /*
     * For each of the service characteristics we need to register setters and getter functions
     * 'get' is called when HomeKit wants to retrieve the current state of the characteristic
     * 'set' is called when HomeKit wants to update the value of the characteristic
     */
    switch (this.config.model) {
      case "MSL120":
        this.service
          .getCharacteristic(Characteristic.On)
          .on("get", this.getOnCharacteristicHandler.bind(this))
          .on("set", this.setOnCharacteristicHandler.bind(this));
        this.service
          .addCharacteristic(Characteristic.Brightness)
          .on("get", this.getBriCharacteristicHandler.bind(this))
          .on("set", this.setBriCharacteristicHandler.bind(this));
        //this.service
          //.addCharacteristic(Characteristic.Hue)
          //.on("get", this.getHueCharacteristicHandler.bind(this))
          //.on("set", this.setHueCharacteristicHandler.bind(this));
        //this.service
          //.addCharacteristic(Characteristic.Saturation)
          //.on("get", this.getSatCharacteristicHandler.bind(this))
          //.on("set", this.setSatCharacteristicHandler.bind(this));
        this.service
          .addCharacteristic(Characteristic.ColorTemperature)
          //.on("get", this.getTmpCharacteristicHandler.bind(this))
          .on("set", this.setTmpCharacteristicHandler.bind(this));
        break;
      default:
        this.service
          .getCharacteristic(Characteristic.On)
          .on("get", this.getOnCharacteristicHandler.bind(this))
          .on("set", this.setOnCharacteristicHandler.bind(this));
    }

    /* Return both the main service (this.service) and the informationService */
    return [informationService, this.service];
  }

  async setOnCharacteristicHandler(value, callback) {
    /* this is called when HomeKit wants to update the value of the characteristic as defined in our getServices() function */
    /* deviceUrl only requires ip address */

    //this.log(this.config, this.config.deviceUrl);
    let response;

    /* Log to the console whenever this function is called */
    this.log.debug(`calling setOnCharacteristicHandler for ${this.config.model} at ${this.config.deviceUrl}...`);

    /*
     * Differentiate requests based on device model.
     */

    switch (this.config.model) {
      case "MSS110-1":
        try {
          response = await doRequest({
            json: true,
            method: "POST",
            strictSSL: false,
            url: `http://${this.config.deviceUrl}/config`,
            headers: {
              "Content-Type": "application/json",
            },
            body: {
              payload: {
                toggle: {
                  onoff: value ? 1 : 0,
                },
              },
              header: {
                messageId: `${this.config.messageId}`,
                method: "SET",
                from: `http://${this.config.deviceUrl}\/config`,
                namespace: "Appliance.Control.Toggle",
                timestamp: this.config.timestamp,
                sign: `${this.config.sign}`,
                payloadVersion: 1,
              },
            },
          });
        } catch (e) {
          this.log(
            `Failed to POST to the Meross Device ${this.config.model} at ${this.config.deviceUrl}:`,
            e
          );
        }
        break;
      default:
        try {
          response = await doRequest({
            json: true,
            method: "POST",
            strictSSL: false,
            url: `http://${this.config.deviceUrl}/config`,
            headers: {
              "Content-Type": "application/json",
            },
            body: {
              payload: {
                togglex: {
                  onoff: value ? 1 : 0,
                  channel: `${this.config.channel}`,
                },
              },
              header: {
                messageId: `${this.config.messageId}`,
                method: "SET",
                from: `http://${this.config.deviceUrl}\/config`,
                namespace: "Appliance.Control.ToggleX",
                timestamp: this.config.timestamp,
                sign: `${this.config.sign}`,
                payloadVersion: 1,
              },
            },
          });
        } catch (e) {
          this.log(
            `Failed to POST to the Meross Device ${this.config.model} at ${this.config.deviceUrl}:`,
            e
          );
        }
    }

    if (response) {
      this.isOn = value;
      this.log.debug("Set succeeded:", response);
      this.log(`${this.config.model} turned`, value ? "On" : "Off");
    } else {
      this.isOn = false;
      this.log("Set failed:", this.isOn);
    }

    /* Log to the console the value whenever this function is called */
    this.log.debug("setOnCharacteristicHandler:", value);

    /*
     * The callback function should be called to return the value
     * The first argument in the function should be null unless and error occured
     */
    callback(null, this.isOn);
  }

  async getOnCharacteristicHandler(callback) {
    /*
     * this is called when HomeKit wants to retrieve the current state of the characteristic as defined in our getServices() function
     * it's called each time you open the Home app or when you open control center
     */

    //this.log(this.config, this.config.deviceUrl);
    let response;

    /* Log to the console whenever this function is called */
    this.log.debug(
      `calling getOnCharacteristicHandler for ${this.config.model} at ${this.config.deviceUrl}...`
    );

    try {
      response = await doRequest({
        json: true,
        method: "POST",
        strictSSL: false,
        url: `http://${this.config.deviceUrl}/config`,
        headers: {
          "Content-Type": "application/json",
        },
        body: {
          payload: {},
          header: {
            messageId: `${this.config.messageId}`,
            method: "GET",
            from: `http://${this.config.deviceUrl}/config`,
            namespace: "Appliance.System.All",
            timestamp: this.config.timestamp,
            sign: `${this.config.sign}`,
            payloadVersion: 1,
          },
        },
      });
    } catch (e) {
      this.log(
        `Failed to POST to the Meross Device ${this.config.model} at ${this.config.deviceUrl}:`,
        e
      );
    }

    /*
     * Differentiate response based on device model.
     */

    switch (this.config.model) {
      default:
        if (response) {
          let onOff =
            response.payload.all.digest.togglex[0].onoff;

          this.log.debug("Retrieved status successfully: ", onOff);
          this.isOn = onOff;
        } else {
          this.log.debug("Retrieved status unsuccessfully.");
          this.isOn = false;
        }
    }

    /* Log to the console the value whenever this function is called */
    this.log.debug("getOnCharacteristicHandler:", this.isOn);

    /*
     * The callback function should be called to return the value
     * The first argument in the function should be null unless and error occured
     * The second argument in the function should be the current value of the characteristic
     * This is just an example so we will return the value from `this.isOn` which is where we stored the value in the set handler
     */
    callback(null, this.isOn);
  }

  async setBriCharacteristicHandler(level, callback) {
    /* this is called when HomeKit wants to update the value of the characteristic as defined in our getServices() function */
    /* deviceUrl only requires ip address */

    //this.log(this.config, this.config.deviceUrl);
    let response;

    /* Log to the console whenever this function is called */
    this.log.debug(`calling setBriCharacteristicHandler for ${this.config.model} at ${this.config.deviceUrl}...`);

    /*
     * Differentiate requests based on device model.
     */

    switch (this.config.model) {
      default:
        try {
          response = await doRequest({
            json: true,
            method: "POST",
            strictSSL: false,
            url: `http://${this.config.deviceUrl}/config`,
            headers: {
              "Content-Type": "application/json",
            },
            body: {
              payload: {
                light: {
                  channel: `${this.config.channel}`,
                  luminance: `${level}`,
                  capacity: '4',
                },
              },
              header: {
                messageId: `${this.config.messageId}`,
                method: "SET",
                from: `http://${this.config.deviceUrl}\/config`,
                namespace: "Appliance.Control.Light",
                timestamp: this.config.timestamp,
                sign: `${this.config.sign}`,
                payloadVersion: 1,
              },
            },
          });
        } catch (e) {
          this.log(
            `Failed to POST to the Meross Device ${this.config.model} at ${this.config.deviceUrl}:`,
            e
          );
        }
    }

    if (response) {
      this.isOn = true;
      this.bri = level;
      this.log.debug("Set succeeded:", response);
      this.log(`${this.config.model} set brightness to`, level);
    } else {
      this.log("Set brightness failed:", this.bri);
    }

    /* Log to the console the value whenever this function is called */
    this.log.debug("setBriCharacteristicHandler:", level);

    /*
     * The callback function should be called to return the value
     * The first argument in the function should be null unless and error occured
     */
    callback(null, this.bri);
  } 

  async getBriCharacteristicHandler(callback) {
    /*
     * this is called when HomeKit wants to retrieve the current state of the characteristic as defined in our getServices() function
     * it's called each time you open the Home app or when you open control center
     */

    //this.log(this.config, this.config.deviceUrl);
    let response;

    /* Log to the console whenever this function is called */
    this.log.debug(
      `calling getOnCharacteristicHandler for ${this.config.model} at ${this.config.deviceUrl}...`
    );

    try {
      response = await doRequest({
        json: true,
        method: "POST",
        strictSSL: false,
        url: `http://${this.config.deviceUrl}/config`,
        headers: {
          "Content-Type": "application/json",
        },
        body: {
          payload: {},
          header: {
            messageId: `${this.config.messageId}`,
            method: "GET",
            from: `http://${this.config.deviceUrl}/config`,
            namespace: "Appliance.System.All",
            timestamp: this.config.timestamp,
            sign: `${this.config.sign}`,
            payloadVersion: 1,
          },
        },
      });
    } catch (e) {
      this.log(
        `Failed to POST to the Meross Device ${this.config.model} at ${this.config.deviceUrl}:`,
        e
      );
    }

    /*
     * Differentiate response based on device model.
     */

    switch (this.config.model) {
      default:
        if (response) {
          this.bri = response.payload.all.digest.light.luminance;
          this.log.debug("Retrieved status successfully: ", this.bri);
        } else {
          this.log.debug("Retrieved status unsuccessfully.");
          this.isOn = false;
        }
    }

    /* Log to the console the value whenever this function is called */
    this.log.debug("getBriCharacteristicHandler:", this.bri);

    /*
     * The callback function should be called to return the value
     * The first argument in the function should be null unless and error occured
     * The second argument in the function should be the current value of the characteristic
     * This is just an example so we will return the value from `this.isOn` which is where we stored the value in the set handler
     */
    callback(null, this.bri);
  }

  async setTmpCharacteristicHandler(level, callback) {
    /* this is called when HomeKit wants to update the value of the characteristic as defined in our getServices() function */
    /* deviceUrl only requires ip address */

    //this.log(this.config, this.config.deviceUrl);
    let response;

    /* Log to the console whenever this function is called */
    this.log.debug(`calling setTmpCharacteristicHandler for ${this.config.model} at ${this.config.deviceUrl}...`);

    /*
     * Differentiate requests based on device model.
     */

    this.log("Temperature Level: "+ level);

    switch (this.config.model) {
      default:
        try {
          response = await doRequest({
            json: true,
            method: "POST",
            strictSSL: false,
            url: `http://${this.config.deviceUrl}/config`,
            headers: {
              "Content-Type": "application/json",
            },
            body: {
              payload: {
                light: {
                  channel: `${this.config.channel}`,
                  luminance: `${this.bri}`,
                  capacity: '2',
                  temperature: `${level}`
                },
              },
              header: {
                messageId: `${this.config.messageId}`,
                method: "SET",
                from: `http://${this.config.deviceUrl}\/config`,
                namespace: "Appliance.Control.Light",
                timestamp: this.config.timestamp,
                sign: `${this.config.sign}`,
                payloadVersion: 1,
              },
            },
          });
        } catch (e) {
          this.log(
            `Failed to POST to the Meross Device ${this.config.model} at ${this.config.deviceUrl}:`,
            e
          );
        }
    }

    if (response) {
      this.isOn = true;
      this.tmp = level;
      this.log.debug("Set succeeded:", response);
      this.log(`${this.config.model} set brightness to`, level);
    } else {
      this.log("Set brightness failed:", this.tmp);
    }

    /* Log to the console the value whenever this function is called */
    this.log.debug("setBriCharacteristicHandler:", level);

    /*
     * The callback function should be called to return the value
     * The first argument in the function should be null unless and error occured
     */
    callback(null, this.tmp);
  } 


}
