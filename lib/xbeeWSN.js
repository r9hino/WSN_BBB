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
        'xbee3': {t: 0, h: 0, l: 0}
    };
}

//******************************************************************************
// Functions for transmiting API frames.

// ZigBee Transmit Request 0x10.
xbee.prototype.ZBTransmitRequest = function (xbeeModule, dataTX) {
    var serialport = this.serialport;
    var xbeeAPI = this.xbeeAPI;
    
    var frame_obj = {
        type: this.C.FRAME_TYPE.ZIGBEE_TRANSMIT_REQUEST,
        destination64: this.addrXbee[xbeeModule],
        destination16: 'fffe', // default is "fffe" (unknown/broadcast)
        broadcastRadius: 0x00, // optional, 0x00 is default
        options: 0x00, // optional, 0x00 is default
        data: dataTX // Can either be string or byte array
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


//******************************************************************************
// Functions for received API frames.


// Frame Handler 0x8B: ZigBee Transmit Status.
// when a Transmit Request is completed, the module respond with ZigBee transmit Status.
xbee.prototype.ZBTransmitStatus = function (frame) {
    switch (frame.deliveryStatus) {
        case 0x00:
            console.log("ZB Transmit Status: Success.");
            break;
        case 0x01:
            console.log("ZB Transmit Status: MAC ACK failure.");
            break;
        case 0x02:
            console.log("ZB Transmit Status: CCA failure.");
            break;
        case 0x15:
            console.log("ZB Transmit Status: Invalid destination endpoint.");
            break;
        case 0x21:
            console.log("ZB Transmit Status: Network ACK failure.");
            break;
        case 0x22:
            console.log("ZB Transmit Status: Not joined to Network.");
            break;
        case 0x23:
            console.log("ZB Transmit Status: Self-addressed.");
            break;
        case 0x24:
            console.log("ZB Transmit Status: Address not found.");
            break;
        case 0x25:
            console.log("ZB Transmit Status: Route not found.");
            break;
        default:
            console.log("ZB Transmit Status: Error " + frame.deliveryStatus);
            break;
    }
};


// Frame Handler 0x90: ZigBee Receive Packet.
// Receive sensor data from remote xbee module.
xbee.prototype.ZBReceivePacket = function (frame) {
    // Find which xbee module sended the packet.
    var xbeeKey = this.getXbeeKeyByAddress(frame.remote64);
    var dataRxByte = frame.data;
    
    // Convert data numbers to string format. Then parse sensor information.
    for (var i=0; i<dataRxByte.length; i++) {
        dataRxByte[i] = String.fromCharCode(dataRxByte[i]);
    }
    
    // Join all array bytes into one string.
    var dataRxStr = dataRxByte.join('');

    // Separate in different cells each sensor measurement.
    var dataRxStrArr  = dataRxStr.split('|');
    console.log(dataRxStrArr);

    for (var i=0; i<dataRxStrArr.length; i++) {
        // First letter of each cell indicate the sensor type.
        var sensorType = dataRxStrArr[i][0];
        // Numbers between letter (first element) and '|' correspond to sensor measurement.
        var sensorValue = dataRxStrArr[i].slice(1,dataRxStrArr[i].length);
        sensorValue = parseFloat(sensorValue);  // Convert from string to float.
        
        switch (sensorType) {
            case 't':   // Temperature Sensor
                console.log('Temperature:', sensorValue);
                this.sensorData[xbeeKey].t = sensorValue;
                break;
            case 'h':   // Humidity Sensor
                console.log('Humidity:', sensorValue);
                this.sensorData[xbeeKey].h = sensorValue;
                break;
            case 'l':   // Light Sensor
                console.log('Light:', sensorValue);
                this.sensorData[xbeeKey].l = sensorValue;
                break;
        }
    }
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
};


// Frame Handler 0x97: Remote Command Response
xbee.prototype.remoteCmdResponse = function (frame) {
    var xbeeKey = this.getXbeeKeyByAddress(frame.remote64);
    switch (frame.commandStatus) {
        case 0x00:
            console.log(xbeeKey + " - Remote Command Response: OK.");
            break;
        case 0x01:
            console.log(xbeeKey + " - Remote Command Response: Error.");
            break;
        case 0x02:
            console.log(xbeeKey + " - Remote Command Response: Invalid command.");
            break;
        case 0x03:
            console.log(xbeeKey + " - Remote Command Response: Invalid Parameter.");
            break;
        case 0x04:
            console.log(xbeeKey + " - Remote Command Response: Remote Command Transmission Failed.");
            break;
    }
};

// Retrieve xbee key based on address: '0013a20040b82646' --> 'xbee1'
xbee.prototype.getXbeeKeyByAddress = function (address) {
    var addrXbee = this.addrXbee;
    for(var key in addrXbee) {
        if( addrXbee[key] === address ) return key;
    }
};