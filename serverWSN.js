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

// System state initialization
var init = require('./init');
// Create or restore system's state JSON file infoWSN.json
var jsonWSN = init.initialization();
var jsonFileName = __dirname + "/infoWSN.json";


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