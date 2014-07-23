var fs = require('fs');
var bbb = require('bonescript');

//var jsonWSN;

function initialization() {
    // This json will be loaded only if there doesn't exist an infoWSN.json file.
    // i.e. if it is the first time running the script, or if infoWSN.json was previewsly deleted
    var jsonWSN = {
        "PB0": {"pin": "P8_10", "name": "Calentador Pipo", "value": 0},
        "PB1": {"pin": "P8_11", "name": "Lampara Pipo", "value": 0}
    };
    
    // Configure pins as input or output
    bbb.pinMode(jsonWSN["PB0"].pin, bbb.OUTPUT);
    bbb.pinMode(jsonWSN["PB1"].pin, bbb.OUTPUT);
    
    var jsonFileName = __dirname + "/infoWSN.json";
    
    // If file exists, system preview's values are restored
    if (fs.existsSync(jsonFileName)) {
        var fileData = fs.readFileSync(jsonFileName);
        jsonWSN = JSON.parse(fileData);
        for(var id in jsonWSN){
            bbb.digitalWrite(jsonWSN[id].pin, jsonWSN[id].value);
        }
        console.log("System initialization OK.");
    }
    // If JSON file doesn't exist, create new one based on jsonWSN variable
    else {
        console.log("File doesn't exist. It will be created now...");
        fs.writeFileSync(jsonFileName, JSON.stringify(jsonWSN, null, 4));
        console.log("JSON saved to " + jsonFileName);
    }
    
    return jsonWSN;
}

exports.initialization = initialization;