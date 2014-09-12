// Initialize devices to preview state.
// Turn on/off devices, depending on system state.

function initDevices (jsonWSN, bbb, xbee) { 
    // Configure pins as input or output
    bbb.pinMode(jsonWSN["dev0"].pin, bbb.OUTPUT);
    bbb.pinMode(jsonWSN["dev1"].pin, bbb.OUTPUT);

    // Restore devices to last state.
    for(var devId in jsonWSN){
        // If device is connected to Beaglebone pin:
        if (jsonWSN[devId].type === 'pin') {
            console.log('Setting up '+jsonWSN[devId].name+' state.');
            bbb.digitalWrite(jsonWSN[devId].pin, jsonWSN[devId].switchValue);
        }
        // If device is connected to an xbee module:
        else if (jsonWSN[devId].type === 'xbee') {
            if(jsonWSN[devId].switchValue === 1) 
                xbee.sendRemoteATCmdReq(jsonWSN[devId].xbee, xbee.C.PIN_MODE.D4.DIGITAL_OUTPUT_HIGH);
            else 
                xbee.sendRemoteATCmdReq(jsonWSN[devId].xbee, xbee.C.PIN_MODE.D4.DIGITAL_OUTPUT_LOW);
            
            console.log('Setting up ' + jsonWSN[devId].name + ' state.');
        }
    }
    console.log("Devices initialization OK.");
}

module.exports = initDevices;
    