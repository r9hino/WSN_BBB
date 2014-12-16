/*
    This module will store:
        - Initial configuration for xbee and serial port.
        - Xbee modules addresses.
        - All functions framework based on xbee-api module.
*/

function xbee(serialport, xbeeAPI, constants){
    this.serialport = serialport;
    this.xbeeAPI = xbeeAPI;

    // xbee-api constants.
    this.C = constants;

    // Store xbee sensor data.
    this.sensorData = {
        'xbee1': {tempAccum: 0, sampleNum: 0},
        'xbee2': {tempAccum: 0, sampleNum: 0},
        'xbee3': {t: 0, h: 0, l: 0},
        'xbee4': {tempAccum: 0, sampleNum: 0},
    };
}

// Xbee module addresses. xbee0 is the coordinator.
addrXbee64 = {
    'xbee0': '0013a20040b08958',
    'xbee1': '0013a20040b82646', 
    'xbee2': '0013a20040a71859', 
    'xbee3': '0013a20040af6912',
    'xbee4': '0013a20040abc31a'
};

addrXbee16 = {
    "xbee0": '0000',
    "xbee1": 'fffe',
    "xbee2": 'fffe',
    "xbee3": 'fffe',
    "xbee4": 'fffe'
};

// Store routes for each module. Left: closer hop to remote module. Right: closer hop to coordinator.
networkRoutes = {
    "xbee1": [],
    "xbee2": [],
    "xbee3": [],
    "xbee4": []
}
xbee.prototype.displayXbeeNodes = function(){
    //console.log(addrXbee64);
    console.log(addrXbee16);
    console.log(networkRoutes);
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
    if((cmdParameter !== '') && (cmdParameter !== null)){
        frame_obj.commandParameter = [cmdParameter];
    }
    
    //console.log(frame_obj);
    serialport.open(function(error){
        if(error)   return console.log("AT Command Request - " + error);
        serialport.write(xbeeAPI.buildFrame(frame_obj), function (err){
            if(err)   return console.log("AT Command Request - " + err);
            //console.log("AT Command Request successfully sended to UART.");
        });
    });
};

// ZigBee Transmit Request 0x10.
xbee.prototype.ZBTransmitRequest = function(xbeeModule, dataTX){
    var serialport = this.serialport;
    var xbeeAPI = this.xbeeAPI;
    
    var frame_obj = {
        type: this.C.FRAME_TYPE.ZIGBEE_TRANSMIT_REQUEST,
        destination64: addrXbee64[xbeeModule],
        destination16: addrXbee16[xbeeModule],  // Default is "fffe" (unknown/broadcast).
        broadcastRadius: 0x00,  // Optional, 0x00 is default.
        options: 0x00,          // Optional, 0x00 is default.
        data: dataTX            // Can either be string or byte array.
    };

    serialport.open(function(error){
        if(error)   return console.log("ZB Transmit Request - " + error);
        serialport.write(xbeeAPI.buildFrame(frame_obj), function (err){
            if(err)   return console.log("ZB Transmit Request - " + err);
            //console.log("ZB Transmit Request successfully sended to UART.");
        });
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
        addr64 = addrXbee64[xbeeModule];
        addr16 = addrXbee16[xbeeModule];
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
    if((cmdParameter !== '') && (cmdParameter !== null)){
        frame_obj.commandParameter = [cmdParameter];
    }

    serialport.open(function(error){
        if(error)   return console.log("Remote AT Command Request - " + error);
        serialport.write(xbeeAPI.buildFrame(frame_obj), function (err){
            if(err)   return console.log("Remote AT Command Request - " + err);
            //console.log(xbeeModule +" - " + ATCmd + " Remote AT Command Request successfully sended to UART.");
        });
    });
};

//******************************************************************************
// Functions for received API frames.

// Frame Handler 0x88: AT Command Response.
xbee.prototype.ATCmdResponse = function(frame){
    //console.log(frame);
    var cmd = frame.command.toUpperCase();
    var cmdData = frame.commandData;
    var cmdStatusKey = frame.commandStatus;
    
    // If cmd respond with commandData, then show it.
    if(cmdStatusKey === 0x00 && typeof(cmdData) !== "undefined" && cmdData !== null && cmdData.length > 0){
        console.log("Coordinator - " + cmd + " " + this.C.FRAME_TYPE[0x88] + ": " +
            this.C.COMMAND_STATUS[cmdStatusKey] + ". Command Data: [" + cmdData + "]");
    }
    else{
        console.log("Coordinator - " + cmd + " " + this.C.FRAME_TYPE[0x88] + ": " +
            this.C.COMMAND_STATUS[cmdStatusKey] + ".");
    }
};

// Frame Handler 0x8B: ZigBee Transmit Status.
// When a Transmit Request is completed, the module respond with ZigBee transmit Status.
xbee.prototype.ZBTransmitStatus = function(frame){
    //console.log(frame);
    var xbeeKey = this.getXbeeKeyByAddress16(frame.remote16);
    var deliveryStatus = frame.deliveryStatus;
    var discoveryStatus = frame.discoveryStatus;
    
    console.log(xbeeKey + " - " + this.C.FRAME_TYPE[0x8B] + ": " +
            this.C.DELIVERY_STATUS[deliveryStatus] + ", " + this.C.DISCOVERY_STATUS[discoveryStatus]);
};


// Frame Handler 0x90: ZigBee Receive Packet.
// Receive string data from remote xbee module ZBTransmitRequest().
xbee.prototype.ZBReceivePacket = function(frame){
    //console.log(frame);
    // Find which xbee module sended the packet.
    var xbeeKey = this.getXbeeKeyByAddress64(frame.remote64);
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
    /*console.log(xbeeKey + ' - ZB Receive Packet (0x90):' + ' t=' + this.sensorData[xbeeKey].t
                                                         + ' h=' + this.sensorData[xbeeKey].h
                                                         + ' l=' + this.sensorData[xbeeKey].l);
    */
    // Update with each ZBReceivePacket() the xbee's 16bit address.
    addrXbee16[xbeeKey] = frame.remote16;
};


// Frame Handler 0x92: ZigBee IO Data Sample Rx Indicator.
// Return xbee key and temperature value.
xbee.prototype.ZBIODataSampleRx = function(frame){
    //console.log(frame);
    var xbeeAnalog = frame.analogSamples.AD3;   // Analog value read by xbee module.
    var volt = (xbeeAnalog/1023)*1.057; // Convert the analog value to a voltage value.

	// Calculate temp in C, .75 volts is 25 C. 10mV/°C
	var temp = 100*(volt - 0.5);
	//console.log(this.getXbeeKeyByAddress64(frame.remote64), xbeeAnalog, volt, temp);

    var xbeeKey = this.getXbeeKeyByAddress64(frame.remote64);
    this.sensorData[xbeeKey].tempAccum += temp;
    this.sensorData[xbeeKey].sampleNum += 1;
    
    //console.log(xbeeKey + ' - ZB IO Data Sample Rx (0x92):' + ' temperature=' + temp.toFixed(2) + '°C.');
    
    // Update with each ZBReceivePacket() the xbee's 16bit address.
    addrXbee16[xbeeKey] = frame.remote16;
};


// Frame Handler 0x97: Remote Command Response
xbee.prototype.remoteCmdResponse = function(frame){
    //console.log(frame);
    var xbeeKey = this.getXbeeKeyByAddress64(frame.remote64);
    var cmd = frame.command.toUpperCase();
    var cmdData = frame.commandData;
    var cmdStatusKey = frame.commandStatus;
    
    // If cmd respond with commandData, then show it.
    if(cmdStatusKey === 0x00 && typeof(cmdData) !== "undefined" && cmdData !== null && cmdData.length > 0){
        console.log(xbeeKey + " - " + cmd + " " + this.C.FRAME_TYPE[0x97] + ": " +
            this.C.COMMAND_STATUS[cmdStatusKey] + ". Command Data: [" + cmdData + "]");
    }
    else{
        console.log(xbeeKey + " - " + cmd + " " + this.C.FRAME_TYPE[0x97] + ": " +
            this.C.COMMAND_STATUS[cmdStatusKey] + ".");
    }

    // Update with each remoteCmdResponse() the xbee's 16bit address.
    addrXbee16[xbeeKey] = frame.remote16;
};

// Frame Handler 0xA1: Route Record Indicator.
xbee.prototype.routeRecordIndicator = function(frame){
    //console.log(frame);
    var xbeeKey = this.getXbeeKeyByAddress64(frame.remote64);
    var hopsAddresses = frame.hopsAddresses;
    
    console.log(xbeeKey + " - " + this.C.FRAME_TYPE[0xA1] + ". " +
            "Hop nodes: [" + hopsAddresses.map(this.getXbeeKeyByAddress16) + "]");

    // Update with each remoteCmdResponse() the xbee's 16bit address.
    addrXbee16[xbeeKey] = frame.remote16;
    
    // Update network routes.
    networkRoutes[xbeeKey] = hopsAddresses;
};


// Retrieve xbee key based on address: '0013a20040b82646' --> 'xbee1'
xbee.prototype.getXbeeKeyByAddress64 = function(address){
    for(var key in addrXbee64){
        if(addrXbee64[key] === address) return key;
    }
};

// Retrieve xbee key based on address: '2143' --> 'xbee1'
xbee.prototype.getXbeeKeyByAddress16 = function(address){
    for(var key in addrXbee16){
        if(addrXbee16[key] === address) return key;
    }
};

// Many to One Route Request Indicator 0xA3.
/*xbee.prototype.MTORouteReqIndicator = function(xbeeModule){
    var serialport = this.serialport;
    var xbeeAPI = this.xbeeAPI;
    
    var frame_obj = {
        type: this.C.FRAME_TYPE.MTO_ROUTE_REQUEST,
        source64: addrXbee64[xbeeModule],
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

module.exports = xbee;