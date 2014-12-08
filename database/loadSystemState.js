var fs = require('fs');

// Load to memory the system state from infoWSN.json file.
// If any error occur trying to load infoWSN.json file, use default one defined here as jsonWSN.
function loadSystemState() {
   
   var jsonFileName = __dirname + "/infoWSN.json";
    
    // This json will be loaded only if there doesn't exist an infoWSN.json file.
    // i.e. if it is the first time running the script, or if infoWSN.json was previewsly deleted.
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
            "name": "Calentador Raul",
            "switchValue": 0,
            "autoMode": 0,
            "autoTime":""
        },
        "dev4": {
            "id":"dev4",
            "type": "xbee",
            "xbee": "xbee3",
            "name": "Xbee Free",
            "switchValue": 0,
            "autoMode": 0,
            "autoTime":""
        }
    };

    // Load system state from jsonWSN.json file.
    try{
        // If file exists, initialize states.
        var fileData = fs.readFileSync(jsonFileName);
        jsonWSN = JSON.parse(fileData);
        console.log("System state loaded successfully.");
    }

    catch(e){
        console.log(e);
        // Here you get the error when the file was not found.
        if (e.code === 'ENOENT'){
            console.log("JSON file doesn't exist. It will be created now...");
            fs.writeFileSync(jsonFileName, JSON.stringify(jsonWSN, null, 4));
            console.log("JSON created and saved to " + jsonFileName);
        }
        // File exist but is empty.
        else if(e.code === undefined){
            console.log("File exists but is empty. Using initial configuration...");
            fs.writeFileSync(jsonFileName, JSON.stringify(jsonWSN, null, 4));
            console.log("JSON saved to " + jsonFileName);
        }
        // Any other error.
        else{
            console.log("Error reading/loading JSON file.");
            console.log(e.code);
            throw e;
        }
    }

    return jsonWSN;
}

module.exports = loadSystemState;