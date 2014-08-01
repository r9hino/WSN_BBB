/*  
    Author: Philippe Ilharreguy
    Company: SET
    
    WSN control server using Node.js
*/

var express = require('express');
var app = express();
var server = app.listen(8888);
var io = require('socket.io').listen(server);
var fs = require('fs');
var bbb = require('bonescript');

app.use(express.static(__dirname + '/public'));

// System state initialization module
var init = require('./init');
// Create or restore system's state JSON file infoWSN.json
var jsonWSN = init.initialization();
var jsonFileName = __dirname + "/infoWSN.json";

//******************************************************************************
// Routes

// Return to client the json file with the system state
app.get('/getSystemState', function(req, res) {
    res.send(jsonWSN);
});

// Set new values for devices
app.get('/setSystemState/:id/:value', function(req, res) {
    res.send([req.params.id, req.params.value]);
});


//******************************************************************************
// Socket connection handlers
//io.set('transports', ['websocket', 'flashsocket', 'htmlfile', 'xhr-polling', 'jsonp-polling', 'polling']);
//console.log(io);
 
io.sockets.on('connection', function (socket) {
    console.log("Client connected. Clients count: " + io.eio.clientsCount);
    socket.on('disconnect', function() {
        console.log('Client disconnected. Clients count: ' + io.eio.clientsCount);
    });
    
    socket.on('buttonPress', updateSystemState);
    
    function updateSystemState (clientData){
        var data = clientData;
        console.log("Name: " + jsonWSN[data.id].name + "  Value: " + data.value +
                    "  Pin: " + jsonWSN[data.id].pin);
        
        // Update system state
        bbb.digitalWrite(jsonWSN[data.id].pin, data.value);
        jsonWSN[data.id].value = data.value;

        // Broadcast new system state to all connected clients
        socket.broadcast.emit('updateClients', clientData);

        // Store new values into json file infoWSN.json
        fs.writeFile(jsonFileName, JSON.stringify(jsonWSN, null, 4), function (err) {
            if(err) console.log(err);
            else console.log("JSON file saved at " + jsonFileName);
        });
    }
});

