/*  
    Author: Philippe Ilharreguy
    Company: SET
    
    WSN control server using Node.js
    
    To execute serverWSN.js as a deamon (bg process + logging) use:
    sudo nohup node serverWSN.js &>> server.log &
    
    Links:
    Cron library:   https://github.com/ncb000gt/node-cron/blob/master/lib/cron.js
    Closure issue:  http://conceptf1.blogspot.com/2013/11/javascript-closures.html
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
var cronTime = require('cron').CronTime;


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
// Schedulers jobs initialization

// Two function initializer where create in order to avoid closure ambiguity.
var schedulerTime = {};
var schedulerJob = {};

function schedulerTimeInitialization (devId) {
    return new cronTime('', null);
}
function schedulerJobInitialization (devId) {
    return new cronJob('', function(){
        bbb.digitalWrite(jsonWSN[devId].pin, 1);
        jsonWSN[devId].switchValue = 1;
        console.log("Automatic on: "+jsonWSN[devId].name);
        io.sockets.emit('updateClients', jsonWSN[devId]);
        // Store new values into json file infoWSN.json
        fs.writeFile(jsonFileName, JSON.stringify(jsonWSN, null, 4), function (err) {
            if(err) console.log(err);
        });
    }, 
    null,   // Function execute after finishing the scheduler.
    false,  // Start the job right now true/false.
    null    // Timezone.
    );
}

for (var devId in jsonWSN) {
    schedulerTime[devId] = schedulerTimeInitialization(devId);
    schedulerJob[devId] = schedulerJobInitialization(devId);
}

//******************************************************************************
// Socket connection handlers
//io.set('transports', ['websocket', 'flashsocket', 'htmlfile', 'xhr-polling', 'jsonp-polling', 'polling']);
io.engine.transports = ['websocket', 'polling'];
console.log(io);

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
    var devId = clientData.id;
    // Store received data in JSON object.
    jsonWSN[devId].switchValue = clientData.switchValue;
    jsonWSN[devId].autoMode = clientData.autoMode;
    jsonWSN[devId].autoTime = clientData.autoTime;  // autoTime must have a valid value, not undefined.
    
    var data = jsonWSN[devId];
    // Update system state
    bbb.digitalWrite(data.pin, data.switchValue);

    console.log(dateTime.getDateTime() +
                "  Name: " + data.name +
                ",  Switch value: " + data.switchValue +
                ",  AutoMode value: " + data.autoMode +
                ",  AutoTime value: " + data.autoTime +
                ",  Pin: " + data.pin);

    // Broadcast new system state to all connected clients
    io.sockets.emit('updateClients', data);


    // Start scheduler only if autoMode is 1 and device is off.
    // Pointless to start scheduler if device is already on.
    // Check that autoTime is not an empty string or undefined, otherwise server will stop working.
    if((data.switchValue === 0) & (data.autoMode === 1) & (data.autoTime !== "")) {
        // Retrieve hours and minutes from client sended data.
        var autoTimeSplit = data.autoTime.split(":");
        // First convert to integer: "02" -> 2. Then convert to string again: 2 -> "2".
        var hourStr = parseInt(autoTimeSplit[0], 10).toString();
        var minuteStr = parseInt(autoTimeSplit[1], 10).toString();

        // Set new values to scheduler.
        schedulerTime[devId].source = '0 '+minuteStr+' '+hourStr+' * * *';
        schedulerTime[devId].hour = {};
        schedulerTime[devId].minute = {};
        schedulerTime[devId].hour[hourStr] = true;
        schedulerTime[devId].minute[minuteStr] = true;
        schedulerJob[devId].setTime(schedulerTime[devId]);
        console.log(schedulerJob[devId].nextDate()+"  "+data.name);
        schedulerJob[devId].start();
    }
    else schedulerJob[devId].stop();


    // Store new values into json file infoWSN.json
    fs.writeFile(jsonFileName, JSON.stringify(jsonWSN, null, 4), function (err) {
        if(err) console.log(err);
        //else console.log("JSON file saved at " + jsonFileName);
    });
}


