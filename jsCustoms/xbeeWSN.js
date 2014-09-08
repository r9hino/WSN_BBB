/*
    This module will store:
        - Initial configuration for xbee and serial port.
        - Xbee modules addresses.
        - All functions framework based on xbee-api module.
*/

//exports = module.exports;
exports.xbee = xbee;

function xbee (serialport, xbeeAPI, constants) {
    this.serialport = serialport;
    this.xbeeAPI = xbeeAPI;

    // xbee-api constants
    this.C = constants;

    // Xbee module addresses:
    this.addrXbee = {
    'xbee1': '0013a20040b82646', 
    'xbee2': '0013a20040a71859', 
    'xbee3': '0013a20040af6912'
    };

    // Store xbee sensor data.
    this.sensorData = {
        'xbee1': {tempAccum: 0, sampleNum: 0},
        'xbee2': {tempAccum: 0, sampleNum: 0},
        'xbee3': {tempAccum: 0, sampleNum: 0}
    };
}


// Remote AT Command Request 0x17.
xbee.prototype.sendRemoteATCmdReq = function (xbeeModule, digitalHL) {
    var serialport = this.serialport;
    var xbeeAPI = this.xbeeAPI;
    
    var frame_obj = {
        type: this.C.FRAME_TYPE.REMOTE_AT_COMMAND_REQUEST,
        destination64: this.addrXbee[xbeeModule],
        destination16: 'fffe', // default is "fffe" (unknown/broadcast)
        command: 'D4',
        commandParameter: [digitalHL]
    };

    serialport.write(xbeeAPI.buildFrame(frame_obj), function (error) {
        if (error) {
            // If there is an error, first try open the serialport.
            serialport.open(function (err) {
                if (err) console.log('Failed to open serial port: ' + err);
                else serialport.write(xbeeAPI.buildFrame(frame_obj));
            });
        }
    });
};


// Frame Handler 0x92: ZigBee IO Data Sample Rx Indicator.
// Return xbee key and temperature value.
xbee.prototype.ZBIODataSampleRx = function (frame) {
    var xbeeAnalog = frame.analogSamples.AD3;   // Analog value read by xbee module.
    var volt = (xbeeAnalog/1023)*1.057; // Convert the analog value to a voltage value.

	// Calculate temp in C, .75 volts is 25 C. 10mV/°C
	var temp = 100*(volt - 0.5);
	//console.log(this.getXbeeKeyByAddress(frame.remote64), xbeeAnalog, volt, temp);

    var xbeeKey = this.getXbeeKeyByAddress(frame.remote64);
    this.sensorData[xbeeKey].tempAccum += temp;
    this.sensorData[xbeeKey].sampleNum += 1;
}


// Frame Handler 0x97: Remote Command Response
xbee.prototype.remoteCmdResponse = function (frame) {
    var commandStatus = frame.commandStatus;
    if(commandStatus === 0) console.log("Remote Command Response: OK.");
    else if(commandStatus === 1) console.log("Remote Command Response: Error.");
    else if(commandStatus === 2) console.log("Remote Command Response: Invalid command.");
    else if(commandStatus === 3) console.log("Remote Command Response: Invalid Parameter.");
    else if(commandStatus === 4) console.log("Remote Command Response: Remote Command Transmission Failed.");
}

// Retreive xbee key based on address: '0013a20040b82646' --> 'xbee1'
xbee.prototype.getXbeeKeyByAddress = function (address) {
    var addrXbee = this.addrXbee;
    for(var key in addrXbee) {
        if( addrXbee[key] === address ) return key;
    }
}