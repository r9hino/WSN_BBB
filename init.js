var fs = require('fs');


function initialization(bbb, xbee) {
    var C = xbee.C;   // xbee-api constants.
    
    // This json will be loaded only if there doesn't exist an infoWSN.json file.
    // i.e. if it is the first time running the script, or if infoWSN.json was previewsly deleted
    var jsonWSN = {
        "dev0": {
            "id":"dev0",
            "type": "pin",
            "pin": "P8_11",
            "name": "Lampara Pipo",
            "switchValue": 0,
            "autoMode": 0,
            "autoTime":""
        },
        "dev1": {
            "id":"dev1",
            "type": "pin",
            "pin": "P8_12",
            "name": "Calentador Pipo",
            "switchValue": 0,
            "autoMode": 0,
            "autoTime":""
        },
        "dev2": {
            "id":"dev2",
            "type": "xbee",
            "xbee": "xbee1",
            "name": "Musica",
            "switchValue": 0,
            "autoMode": 0,
            "autoTime":""
        },
        "dev3": {
            "id":"dev3",
            "type": "xbee",
            "xbee": "xbee2",
            "name": "Lampara 2",
            "switchValue": 0,
            "autoMode": 0,
            "autoTime":""
        },
        "dev4": {
            "id":"dev4",
            "type": "xbee",
            "xbee": "xbee3",
            "name": "Calentador Mama",
            "switchValue": 0,
            "autoMode": 0,
            "autoTime":""
        }
    };
    
    // Configure pins as input or output
    bbb.pinMode(jsonWSN["dev0"].pin, bbb.OUTPUT);
    bbb.pinMode(jsonWSN["dev1"].pin, bbb.OUTPUT);
    
    var jsonFileName = __dirname + "/infoWSN.json";
    
    try {
        // If file exists, initialize states.
        var fileData = fs.readFileSync(jsonFileName);
        jsonWSN = JSON.parse(fileData);
        
        // Restore system last state.
        for(var devId in jsonWSN){
            if (jsonWSN[devId].type === 'pin') {
                console.log('Setting up '+jsonWSN[devId].name+' state.');
                bbb.digitalWrite(jsonWSN[devId].pin, jsonWSN[devId].switchValue);
            }
            else if (jsonWSN[devId].type === 'xbee') {
                if(jsonWSN[devId].switchValue === 1) xbee.sendRemoteATCmdReq(jsonWSN[devId].xbee, C.PIN_MODE.D4.DIGITAL_OUTPUT_HIGH);
                else xbee.sendRemoteATCmdReq(jsonWSN[devId].xbee, C.PIN_MODE.D4.DIGITAL_OUTPUT_LOW);
                console.log('Setting up '+jsonWSN[devId].name+' state.');
            }
        }
        console.log("System initialization OK.");
    }
    catch (e) {
        console.log(e);
        // Here you get the error when the file was not found.
        if (e.code === 'ENOENT') {
            console.log("JSON file doesn't exist. It will be created now...");
            fs.writeFileSync(jsonFileName, JSON.stringify(jsonWSN, null, 4));
            console.log("JSON created and saved to " + jsonFileName);
        }
        // File exist but is empty.
        else if (e.code === undefined) {
            console.log("File exists but is empty. Using initial configuration...");
            fs.writeFileSync(jsonFileName, JSON.stringify(jsonWSN, null, 4));
            console.log("JSON saved to " + jsonFileName);
        }
        // Any other error.
        else {
            console.log("Error reding/loading JSON file.");
            console.log(e.code);
            throw e;
        }
    }

    return jsonWSN;
}

exports.initialization = initialization;