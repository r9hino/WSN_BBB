/*  
    WSN control server using Node.js
*/

var express = require('express');
var app = express();
var server = app.listen(5555);
var io = require('socket.io').listen(server);
var fs = require('fs');
var bbb = require('bonescript');

app.use(express.static(__dirname + '/public'));

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
fs.readFile(jsonFileName, function(error, fileData) {
    // If file doesn't exist, it will create one with an initial JSON
    if(error){
        console.log("File doesn't exist. It will be created now...");
        fs.writeFile(jsonFileName, JSON.stringify(jsonWSN, null, 4), function(err) {
            if(err) console.log(err);
            else console.log("JSON saved to " + jsonFileName);
        });
    }
    // If it does exist, load JSON file into a variable, and
    // initialize system state from preview stored json file
    else {
        jsonWSN = JSON.parse(fileData);
        for(var id in jsonWSN){
            bbb.digitalWrite(jsonWSN[id].pin, jsonWSN[id].value);
        }
    }
});

io.sockets.on('connection', function (socket) {
    socket.on('buttonPress', updateSystemState);
});

function updateSystemState (jsonClientData){
    var data = JSON.parse(jsonClientData);
    console.log("write pin: " + jsonWSN[data.id].pin + " value: " + data.value);
    
    // Update system state
    bbb.digitalWrite(jsonWSN[data.id].pin, data.value);
    jsonWSN[data.id].value = data.value;
        
    // Store new values into json file infoWSN.json
    fs.writeFile(jsonFileName, JSON.stringify(jsonWSN, null, 4), function (err) {
        if(err) console.log(err);
        else console.log("JSON saved to " + jsonFileName);
    });
}