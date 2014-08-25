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
};

// Send remote AT command request to xbee module.
xbee.prototype.sendRemoteATCmdReq = function (xbeeModule, digitalHL){
    var serialport = this.serialport;
    var xbeeAPI = this.xbeeAPI;
    
    var frame_obj = {
        type: this.C.FRAME_TYPE.REMOTE_AT_COMMAND_REQUEST,
        destination64: this.addrXbee[xbeeModule],
        destination16: 'fffe', // default is "fffe" (unknown/broadcast)
        command: 'D4',
        commandParameter: [digitalHL]
    };

    //console.log('Open');
    serialport.open(function (error) {
        if (error) console.log('Failed to open serial port: ' + error);
        else serialport.write(xbeeAPI.buildFrame(frame_obj));
    });
};
