/*  
    Author: Philippe Ilharreguy
    Company: SET
    
    WSN control server using Node.js
    
    To execute serverWSN.js as a deamon (bg process + logging) use:
    sudo nohup node serverWSN.js &>> server.log &
*/

var express = require('express');
var app = express();
var server = app.listen(8888);
var io = require('socket.io').listen(server);
var fs = require('fs');
var bbb = require('bonescript');
var cronJob = require('cron').CronJob;


// System state initialization module
var init = require('./init');
// Create or restore system's state JSON file infoWSN.json
var jsonWSN = init.initialization();
var jsonFileName = __dirname + "/infoWSN.json";

// Date instance for logging date and time.
var dateTime = require('./dateTime');


//******************************************************************************
// Routes

app.use(express.static(__dirname + '/public'));

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

// Scheduling job with cron module.
var job = new cronJob('*/5 * 19 * * 1-5', 
    function(){ updateSystemState({"id":"pb1", "value":1}); }, 
    null,
    true, /* Start the job right now */
    null
);
//console.log(job);
//job.start();

io.sockets.on('connection', function (socket) {
    console.log(dateTime.getDateTime() + '  Client connected. Clients count: ' + io.eio.clientsCount);
    socket.on('disconnect', function() {
        console.log(dateTime.getDateTime() + '  Client disconnected. Clients count: ' + io.eio.clientsCount);
    });
    
    socket.on('buttonPress', updateSystemState);
    socket.on('checkBoxPress', updateSystemState);
});

// Update system state based on clientData parameter object.
function updateSystemState (clientData){
    /*  Some properties from clientData may have undefined value depending on 
        which jquery element sended the clientData. All not undefined properties
        on clientData will be saved on the jsonWSN object. All undefined 
        properties will be replaced with the stored properties from jsonWSN.
    */
    if(clientData.value !== undefined) {
        jsonWSN[clientData.id].value = clientData.value;
    }
    if(clientData.autoMode !== undefined) {
        jsonWSN[clientData.id].autoMode = clientData.autoMode;
    }
    //console.log(jsonWSN[clientData.id]);
    var data = jsonWSN[clientData.id];
    
    console.log(dateTime.getDateTime() +
                "  Name: " + data.name +
                "  Button value: " + data.value +
                "  Checkbox value: " + data.autoMode +
                "  Pin: " + data.pin);

    // Update system state
    bbb.digitalWrite(data.pin, data.value);
    
    // Broadcast new system state to all connected clients
    io.sockets.emit('updateClients', data);

    // Store new values into json file infoWSN.json
    fs.writeFile(jsonFileName, JSON.stringify(jsonWSN, null, 4), function (err) {
        if(err) console.log(err);
        //else console.log("JSON file saved at " + jsonFileName);
    });
}
