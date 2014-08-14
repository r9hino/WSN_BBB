/*  
    Author: Philippe Ilharreguy
    Company: SET
    
    WSN control server using Node.js
    
    To execute serverWSN.js as a deamon (bg process + logging) use:
    sudo nohup node serverWSN.js &>> server.log &
*/

require('nodetime').profile({
    accountKey: 'e54a03c529e0fcfa708e33d960d219579411194d', 
    appName: 'serverWSN.js'
  });
  
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

// Scheduling jobs with cron module.
var lightScheduler = new cronJob('*/10 * * * * *', function(){ 
        bbb.digitalWrite(jsonWSN["dev0"].pin, 1);
        jsonWSN["dev0"].switchValue = 1;
        io.sockets.emit('updateClients', jsonWSN["dev0"]);
        // Store new values into json file infoWSN.json
        fs.writeFile(jsonFileName, JSON.stringify(jsonWSN, null, 4), function (err) {
            if(err) console.log(err);
        });
    }, 
    null,
    false, /* Start the job right now true/false. */
    null
);

var heaterTime = new cronTime('0 0 8 * * *', null);
var heaterScheduler = new cronJob('', function(){
        bbb.digitalWrite(jsonWSN["dev1"].pin, 1);
        jsonWSN["dev1"].switchValue = 1;
        io.sockets.emit('updateClients', jsonWSN["dev1"]);
        // Store new values into json file infoWSN.json
        fs.writeFile(jsonFileName, JSON.stringify(jsonWSN, null, 4), function (err) {
            if(err) console.log(err);
        });
    }, 
    null,
    false, /* Start the job right now true/false. */
    null
);


// Listen to changes made from the clients control panel.
io.sockets.on('connection', function (socket) {
    console.log(dateTime.getDateTime() + '  Client connected. Clients count: ' + io.eio.clientsCount);
    socket.on('disconnect', function() {
        console.log(dateTime.getDateTime() + '  Client disconnected. Clients count: ' + io.eio.clientsCount);
    });
    
    socket.on('elementChanged', updateSystemState);
});

// Update system state based on clientData property values sended by client's browsers.
// clientData format is: {"id":"dev0", "switchValue":1} or {"id":"dev0", "autoMode":1}
function updateSystemState (clientData){
    // Store received data in JSON object.
    jsonWSN[clientData.id].switchValue = clientData.switchValue;
    jsonWSN[clientData.id].autoMode = clientData.autoMode;
    jsonWSN[clientData.id].autoTime = clientData.autoTime;

    var data = jsonWSN[clientData.id];

    console.log(dateTime.getDateTime() +
                "  Name: " + data.name +
                ",  Switch value: " + data.switchValue +
                ",  AutoMode value: " + data.autoMode +
                ",  AutoTime value: " + data.autoTime +
                ",  Pin: " + data.pin);

    // Update system state
    bbb.digitalWrite(data.pin, data.switchValue);

    // Start scheduler only if autoMode is 1 and device is off.
    // Pointless to start scheduler if device is already on.
    if((jsonWSN["dev0"].switchValue === 0) & (jsonWSN["dev0"].autoMode === 1)) lightScheduler.start();
    else lightScheduler.stop();
    if((jsonWSN["dev1"].switchValue === 0) & (jsonWSN["dev1"].autoMode === 1)) heaterScheduler.start();
    else heaterScheduler.stop();

    // Broadcast new system state to all connected clients
    io.sockets.emit('updateClients', data);

    // Store new values into json file infoWSN.json
    fs.writeFile(jsonFileName, JSON.stringify(jsonWSN, null, 4), function (err) {
        if(err) console.log(err);
        //else console.log("JSON file saved at " + jsonFileName);
    });
}
