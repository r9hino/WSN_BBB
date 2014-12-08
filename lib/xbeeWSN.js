/*
    This module will store:
        - Initial configuration for xbee and serial port.
        - Xbee modules addresses.
        - All functions framework based on xbee-api module.
*/

exports.xbee = xbee;

function xbee (serialport, xbeeAPI, constants) {
    this.serialport = serialport;
    this.xbeeAPI = xbeeAPI;

    // xbee-api constants
    this.C = constants;

    // Xbee module addresses:
    this.addrXbee64 = {
    'coordinator': '0013a20040b08958',
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

// AT Command Request 0x08. In this case is the coordinator who will receive the command.
xbee.prototype.ATCmdReq = function(frameId, cmd, cmdParameter){
    var serialport = this.serialport;
    var xbeeAPI = this.xbeeAPI;
    
    var frame_obj = {
        type: this.C.FRAME_TYPE.AT_COMMAND, // 0x08
        command: cmd
    }
    // If an id frame was explicitly pass as parameter then use it.  
    if(frameId !== null){
        frame_obj.id = frameId;
    }
    // Do not create frame_obj.commandParameter key when cmdParameter is empty, this way
    // xbeeAPI.buildFrame() will interpret it as a remote AT command with no parameter.
    if (cmdParameter !== '') {
        frame_obj.commandParameter = [cmdParameter];
    }
    
    serialport.write(xbeeAPI.buildFrame(frame_obj), function(error){
        if (error){
            // If there is an error, first try open the serialport.
            serialport.open(function(err){
                if (err) console.log('Failed to open serial port: ' + err);
                else serialport.write(xbeeAPI.buildFrame(frame_obj));
            });
        }
    });
}

// ZigBee Transmit Request 0x10.
xbee.prototype.ZBTransmitRequest = function(xbeeModule, dataTX){
    var serialport = this.serialport;
    var xbeeAPI = this.xbeeAPI;
    
    var frame_obj = {
        type: this.C.FRAME_TYPE.ZIGBEE_TRANSMIT_REQUEST,
        destination64: this.addrXbee64[xbeeModule],
        destination16: 'fffe',  // Default is "fffe" (unknown/broadcast).
        broadcastRadius: 0x00,  // Optional, 0x00 is default.
        options: 0x00,          // Optional, 0x00 is default.
        data: dataTX            // Can either be string or byte array.
    };

    serialport.write(xbeeAPI.buildFrame(frame_obj), function(error){
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
xbee.prototype.remoteATCmdReq = function(xbeeModule, idFrame, ATCmd, cmdParameter){
    var serialport = this.serialport;
    var xbeeAPI = this.xbeeAPI;
    var addr64;
    var addr16;
    
    // When is a broadcast message change destination64 key to 0x000000000000FFFF
    if(xbeeModule === 'broadcast'){
        addr64 = '000000000000ffff';
        addr16 = 'fffe';
    }
    else{
        addr64 = this.addrXbee64[xbeeModule];
        addr16 = 'fffe';
    }
    
    var frame_obj = {
        type: this.C.FRAME_TYPE.REMOTE_AT_COMMAND_REQUEST,
        destination64: addr64,
        destination16: addr16, // default is "fffe" (unknown/broadcast)
        command: ATCmd
    };
    // If an id frame was explicitly pass as parameter then use it.  
    if(idFrame !== null){
        frame_obj.id = idFrame;
    }
    // Do not create frame_obj.commandParameter key when cmdParameter is empty, this way
    // xbeeAPI.buildFrame() will interpret it as a remote AT command with no parameter.
    if (cmdParameter !== '') {
        frame_obj.commandParameter = [cmdParameter];
    }

    serialport.write(xbeeAPI.buildFrame(frame_obj), function (error){
        if (error){
            // If there is an error, first try open the serialport.
            serialport.open(function (err) {
                if (err) console.log('Failed to open serial port: ' + err);
                else serialport.write(xbeeAPI.buildFrame(frame_obj));
            });
        }
    });
};

// Many to One Route Request Indicator 0xA3.
/*xbee.prototype.MTORouteReqIndicator = function(xbeeModule){
    var serialport = this.serialport;
    var xbeeAPI = this.xbeeAPI;
    
    var frame_obj = {
        type: this.C.FRAME_TYPE.MTO_ROUTE_REQUEST,
        source64: this.addrXbee64[xbeeModule],
        source16: '0000'         // Default is "0x00 0x00" (Coordinator 16bit address).
    };

    serialport.write(xbeeAPI.buildFrame(frame_obj), function(error){
        if (error) {
            // If there is an error, first try open the serialport.
            serialport.open(function (err) {
                if (err) console.log('Failed to open serial port: ' + err);
                else serialport.write(xbeeAPI.buildFrame(frame_obj));
            });
        }
    });
};
*/
//******************************************************************************
// Functions for received API frames.

// Frame Handler 0x88: AT Command Response.
xbee.prototype.ATCmdResponse = function(frame){
    console.log(frame);
    var cmd = frame.command;
    var cmdData = frame.commandData;
    switch(frame.commandStatus){
        case 0x00:
            if (typeof(cmdData) !== "undefined" && cmdData !== null && cmdData.length > 0)
                console.log("Coordinator - " + cmd + " AT Command Response (0x88): Ok. " + "Command Data: [" + cmdData + "]");
            else
                console.log("Coordinator - " + cmd + " AT Command Response (0x88): Ok.");
            break;
        case 0x01:
            console.log("Coordinator - " + cmd + " AT Command Response (0x88): Error.");
            break;
        case 0x02:
            console.log("Coordinator - " + cmd + " AT Command Response (0x88): Invalid command.");
            break;
        case 0x03:
            console.log("Coordinator - " + cmd + " AT Command Response (0x88): Invalid parameter.");
            break;
        case 0x04:
            console.log("Coordinator - " + cmd + " AT Command Response (0x88): Tx failure.");
            break;
    }
};

// Frame Handler 0x8B: ZigBee Transmit Status.
// When a Transmit Request is completed, the module respond with ZigBee transmit Status.
xbee.prototype.ZBTransmitStatus = function(frame){
    //console.log(frame);
    var xbeeKey = this.getXbeeKeyByAddress(frame.remote64);
    switch(frame.deliveryStatus){
        case 0x00:
            console.log(xbeeKey + " - ZB Transmit Status (0x8B): Success.");
            break;
        case 0x01:
            console.log(xbeeKey + " - ZB Transmit Status (0x8B): MAC ACK failure.");
            break;
        case 0x02:
            console.log(xbeeKey + " - ZB Transmit Status (0x8B): CCA failure.");
            break;
        case 0x15:
            console.log(xbeeKey + " - ZB Transmit Status (0x8B): Invalid destination endpoint.");
            break;
        case 0x21:
            console.log(xbeeKey + " - ZB Transmit Status (0x8B): Network ACK failure.");
            break;
        case 0x22:
            console.log(xbeeKey + " - ZB Transmit Status (0x8B): Not joined to Network.");
            break;
        case 0x23:
            console.log(xbeeKey + " - ZB Transmit Status (0x8B): Self-addressed.");
            break;
        case 0x24:
            console.log(xbeeKey + " - ZB Transmit Status (0x8B): Address not found.");
            break;
        case 0x25:
            console.log(xbeeKey + " - ZB Transmit Status (0x8B): Route not found.");
            break;
        default:
            console.log(xbeeKey + " - ZB Transmit Status (0x8B): Error " + frame.deliveryStatus);
            break;
    }
};


// Frame Handler 0x90: ZigBee Receive Packet.
// Receive string data from remote xbee module ZBTransmitRequest().
xbee.prototype.ZBReceivePacket = function(frame){
    //console.log(frame);
    // Find which xbee module sended the packet.
    var xbeeKey = this.getXbeeKeyByAddress(frame.remote64);
    var dataRxByte = frame.data;
    
    // Convert data numbers to string format. Then parse sensor information.
    for(var i=0; i<dataRxByte.length; i++){
        dataRxByte[i] = String.fromCharCode(dataRxByte[i]);
    }
    
    // Join all array bytes into one string.
    var dataRxStr = dataRxByte.join('');

    // Separate in different cells each sensor measurement.
    var dataRxStrArr = dataRxStr.split('|');
    //console.log(dataRxStrArr);

    for(var i=0; i<dataRxStrArr.length; i++){
        // First letter of each cell indicate the sensor type.
        var sensorType = dataRxStrArr[i][0];
        // Numbers between letter (first element) and '|' correspond to sensor measurement.
        var sensorValue = dataRxStrArr[i].slice(1, dataRxStrArr[i].length);
        sensorValue = parseFloat(sensorValue);  // Convert from string to float.
        
        switch(sensorType){
            case 't':   // Temperature Sensor.
                //console.log('Temperature:', sensorValue);
                this.sensorData[xbeeKey].t = sensorValue;
                break;
            case 'h':   // Humidity Sensor.
                //console.log('Humidity:', sensorValue);
                this.sensorData[xbeeKey].h = sensorValue;
                break;
            case 'l':   // Light Sensor.
                //console.log('Light:', sensorValue);
                this.sensorData[xbeeKey].l = sensorValue;
                break;
        }
    }
    console.log(xbeeKey + ' - ZB Receive Packet (0x90):' + ' t=' + this.sensorData[xbeeKey].t
                                                         + ' h=' + this.sensorData[xbeeKey].h
                                                         + ' l=' + this.sensorData[xbeeKey].l);
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
xbee.prototype.remoteCmdResponse = function(frame){
    var xbeeKey = this.getXbeeKeyByAddress(frame.remote64);
    var cmdData = frame.commandData;
    var cmd = frame.command;
    //console.log(frame);
    switch (frame.commandStatus) {
        case 0x00:
            if (typeof(cmdData) !== "undefined" && cmdData !== null && cmdData.length > 0)
                console.log(xbeeKey + " - " + cmd + " Remote Command Response (0x97): OK. " + "Command Data: [" + cmdData + "]");
            else
                console.log(xbeeKey + " - " + cmd + " Remote Command Response (0x97): OK.");
            break;
        case 0x01:
            console.log(xbeeKey + " - " + cmd + " Remote Command Response (0x97): Error.");
            break;
        case 0x02:
            console.log(xbeeKey + " - " + cmd + " Remote Command Response (0x97): Invalid command.");
            break;
        case 0x03:
            console.log(xbeeKey + " - " + cmd + " Remote Command Response (0x97): Invalid Parameter.");
            break;
        case 0x04:
            console.log(xbeeKey + " - " + cmd + " Remote Command Response (0x97): Remote Command Transmission Failed.");
            break;
    }
};

// Retrieve xbee key based on address: '0013a20040b82646' --> 'xbee1'
xbee.prototype.getXbeeKeyByAddress = function(address){
    //var addrXbee = this.addrXbee;
    for(var key in this.addrXbee64) {
        if( this.addrXbee64[key] === address ) return key;
    }
};