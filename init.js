var fs = require('fs');
var bbb = require('bonescript');

function initialization() {
    // This json will be loaded only if there doesn't exist an infoWSN.json file.
    // i.e. if it is the first time running the script, or if infoWSN.json was previewsly deleted
    var jsonWSN = {
        "pb0": {"pin": "P8_10", "name": "Calentador Pipo", "value": 0},
        "pb1": {"pin": "P8_11", "name": "Lampara Pipo", "value": 0}
    };
    
    // Configure pins as input or output
    bbb.pinMode(jsonWSN["pb0"].pin, bbb.OUTPUT);
    bbb.pinMode(jsonWSN["pb1"].pin, bbb.OUTPUT);
    
    var jsonFileName = __dirname + "/infoWSN.json";
    
    try {
        var fileData = fs.readFileSync(jsonFileName);
        jsonWSN = JSON.parse(fileData);
        for(var id in jsonWSN){
            bbb.digitalWrite(jsonWSN[id].pin, jsonWSN[id].value);
        }
        console.log("System initialization OK.");
    }
    catch (e) {
        // Here you get the error when the file was not found.
        if (e.code === 'ENOENT') {
            console.log("File doesn't exist. It will be created now...");
            fs.writeFileSync(jsonFileName, JSON.stringify(jsonWSN, null, 4));
            console.log("JSON saved to " + jsonFileName);
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