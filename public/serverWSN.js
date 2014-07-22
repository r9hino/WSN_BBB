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

var jsonWSN = {"PB": [
        {"id": "PB0", "pin": "P8_10", "name": "Calentador Pipo", "value": 0},
        {"id": "PB1", "pin": "P8_11", "name": "Lampara Pipo", "value": 0}
    ]};
var jsonNewWSN;

console.log(jsonWSN.PB[0].name);

var jsonFileName = __dirname + "/infoWSN.json";
fs.readFile(jsonFileName, function(error, fileData) {
    // If file doesn't exist, it will create one with an initial JSON
    if(error){
        console.log("File doesn't exist. It will be created now...");
        fs.writeFile(jsonFileName, JSON.stringify(jsonWSN, null, 4), function(err) {
            if(err) {
                console.log(err);
            }
            else {
                console.log("JSON saved to " + jsonFileName);
            }
        });
    }
    // If it does exist, load JSON file into a variable
    else {
        jsonNewWSN = JSON.parse(fileData);
        console.log(jsonNewWSN.PB[0]);
    }
});
console.log(jsonWSN.PB[0]);

io.sockets.on('connection', function (socket) {
    socket.on('digitalWrite', function(jsonClientData){
        var data = JSON.parse(jsonClientData);
        console.log("write pin:" + data.pin + " value:" + data.value);
        bbb.digitalWrite(data.pin, data.value);
    });
});



   