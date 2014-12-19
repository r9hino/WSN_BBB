/*  
    Author: Philippe Ilharreguy
    Company: SET

    WSN control server using Node.js.

    To execute serverWSN.js as a deamon (bg process + logging) use:
    sudo nohup node serverWSN.js &>> server.log &

    Links:
    Express, routes, app example: https://github.com/cwbuecheler/node-tutorial-2-restful-app
    Cron library:   https://github.com/ncb000gt/node-cron/blob/master/lib/cron.js
    Closure issue:  http://conceptf1.blogspot.com/2013/11/javascript-closures.html
    Authentication: https://github.com/jaredhanson/passport-local/tree/master/examples/login
*/

// Monitoring system modules.
/*require('nodetime').profile({
    accountKey: 'e54a03c529e0fcfa708e33d960d219579411194d', 
    appName: 'serverWSN.js'
});
*/

// Application modules
var fs = require('graceful-fs');    // Handle file system read/write.
var async = require("async");
var Q = require('q');
var bbb = require('bonescript');
var cronJob = require('/var/lib/cloud9/WSN/custom_modules/cron').CronJob;
var cronTime = require('/var/lib/cloud9/WSN/custom_modules/cron').CronTime;
var SerialPort = require('serialport').SerialPort;
var xbee_api = require('/var/lib/cloud9/WSN/custom_modules/xbee-api');
var ThingSpeakClient = require('thingspeakclient');

// Date instance for logging date and time.
var dateTime = require('./lib/dateTime');

// Xbee RX and TX functions.
var xbeeWSN = require('./lib/xbeeWSN');

// Allow to initialize devices to the preview system state.
var initDevices = require('./lib/initDevices');

// Load preview system state.
var jsonFileName = __dirname + "/database/systemState.json";
var loadSystemState = require('./database/loadSystemState');
var jsonSystemState = loadSystemState();    // Load to memory system's state from systemState.json file.

// ThingSpeak initialization.
var thingspeak = new ThingSpeakClient();
thingspeak.attachChannel(11818, {writeKey:'1EQD8TANGANJHA3J'}, function(error){
    if(error)   return console.log('ThingSpeak client ' + error);
    console.log('Thingspeak client ready.');
});

//******************************************************************************
// Wireless Sensor Network Initialization.

// Serialport and xbee initialization.
var xbeeAPI = new xbee_api.XBeeAPI({
    api_mode: 2
});
var C = xbee_api.constants;   // xbee-api constants
var serialport = new SerialPort("/dev/ttyO2", {
    baudrate: 115200,
    bufferSize: 1024,
    parser: xbeeAPI.rawParser()
});

var xbee = new xbeeWSN(serialport, xbeeAPI, C);


//******************************************************************************
// Passport, Express and Routes configuration
var app = require('./app_routes/app');

var server; // server = app.listen(8888);
var io;     // io = require('socket.io')(server);

// First: Initialize WSN discovering if possible all nodes.
// Second: Initialize all devices in the network to the preview state.
// Third: Initiliaze http server.
// Fourth: Initialize socket.io.
async.series([
    function(callback){ 
        xbee.WSNNodeDiscovery(function(error){
            if(error){
                console.log(error);
                console.log('Nodes not discovered are: ' + xbee.searchNodesNotDiscovered());
            }
            else{
                console.log('Node Discovery Complete.'); // All node have been discovered.
            }
            // Main listener for xbee rx frames.
            xbeeAPI.on("frame_object", xbeeFrameListener);
            console.log("Enable main listener for xbee's received frames.");
            callback(null);
        });
    },
    function(callback){
        initDevices(jsonSystemState, bbb, xbee);
        callback(null);
    },
    function(callback){
        server = app.listen(8888, function(error){
            if(error) return callback(error);
            console.log('Server listening on port 8888.');
            callback(null);
        }); 
    },
    function(callback){
        io = require('socket.io')(server, {
            pingInterval: 7000,
            pingTimeout: 16000,
            transports: ['polling', 'websocket', 'flashsocket', 'xhr-polling']
        });
        io.on('connection', socketConnection);
        console.log("Socket.io is ready.");
        callback(null);
    }],
    function(err){ //This function gets called after all tasks has called its callback functions.
        if(err) return console.log(err);
        console.log('System initialization using async series is complete.');
    }
);

//******************************************************************************
// Scheduler objects initialization and function job definition.
var schedulerJob = [];
(function initScheduler(){
    for(var devId in jsonSystemState){
        schedulerJob[devId] = new cronJob('', null, null, false, null); // Just create the objects.
    }
})();
// This is what is going to be executed when the cron time arrive.
function jobAutoOn(devId){
    jsonSystemState[devId].switchValue = 1;
    // Depend on device type (pin or xbee), a different function will control the device.
    if(jsonSystemState[devId].type === 'pin')  bbb.digitalWrite(jsonSystemState[devId].pin, 1);
    else if(jsonSystemState[devId].type === 'xbee') xbee.remoteATCmdReq(jsonSystemState[devId].xbee, null, 'D4', C.PIN_MODE.D4.DIGITAL_OUTPUT_HIGH);
    
    console.log(dateTime() + '  Automatic on: ' + jsonSystemState[devId].name);
    io.sockets.emit('updateClients', jsonSystemState[devId]);
    // Store new values into json file systemState.json
    fs.writeFile(jsonFileName, JSON.stringify(jsonSystemState, null, 4), function(err){
        if(err) return console.log(err);
    });
}


//******************************************************************************
// Socket connection handlers
// Listen to changes made from the clients control panel.
function socketConnection(socket){
    var connectIP = socket.client.conn.remoteAddress;
    console.log(dateTime() + '  IP ' + connectIP + ' connected. Clients count: ' + io.eio.clientsCount);
    socket.on('disconnect', function(){
        var disconnectIP = socket.client.conn.remoteAddress;
        console.log(dateTime() + '  IP ' + disconnectIP + ' disconnected. Clients count: ' + io.eio.clientsCount);
    });
    
    // Send jsonSystemState data (BBB pins and xbees) to client at the beginning of connection.
    socket.emit('jsonSystemState', jsonSystemState);
    
    // Send Xbees/Nodes network states (routes, addresses, devices down) to client admin web page.
    // Unfortunately, it will be also sended to clientWSN web page.
    //console.log(xbee.xbeeWSNState());
    socket.emit('jsonXbeeWSNInfo', xbee.getXbeeWSNInfo());
    
    // Listen for client xbee remote AT command request.
    socket.on('clientXbeeCmdReq', function(xbeeCmdObj){
        var xbeeId = xbeeCmdObj.xbeeId;     // Requested xbee id from client (broadcast, xbee1, xbee2...). 
        var xbeeCmd = xbeeCmdObj.xbeeCmd;   // Requested xbee cmd from client.
        var xbeeParam = xbeeCmdObj.xbeeParam;
        
        if((xbeeCmd !== undefined) && (xbeeCmd !== null) && (xbeeCmd !== '')){
            xbeeCmd = xbeeCmd.toUpperCase();
            console.log(xbeeId + ' - Client xbee command request: ' + xbeeCmd + ' ' + xbeeParam);
            if(xbeeId !== 'coordinator') xbee.remoteATCmdReq(xbeeId, null, xbeeCmd, xbeeParam);
            else xbee.ATCmdReq(null, xbeeCmd, xbeeParam);  // If coordinator was selected, send a local cmd req.
        }
        return;
    });     // socket.on('xbeeClientCmdReq', function(xbeeCmdObj){}) end.
    
    
    
    // Listen for changes made by user on browser/client side. Then update system state.
    // Update system state based on clientData values sended by client's browsers.
    // clientData format is: {'id':devId, 'switchValue':switchValue, 'autoMode':autoMode, 'autoTime':autoTime}
    socket.on('elementChanged', updateSystemState);
    function updateSystemState(clientData){
        var devId = clientData.id;
        // Store received data in JSON object.
        jsonSystemState[devId].switchValue = clientData.switchValue;
        jsonSystemState[devId].autoMode = clientData.autoMode;
        jsonSystemState[devId].autoTime = clientData.autoTime;  // autoTime must have a valid value, not undefined.

        var data = jsonSystemState[devId];

        // Update system state
        // Depend on device type (pin or xbee), a different function will control the device.
        if(data.type === 'pin')  bbb.digitalWrite(data.pin, data.switchValue);
        else if(data.type === 'xbee'){
            if(data.switchValue === 1){
                xbee.remoteATCmdReq(data.xbee, null, 'D4', C.PIN_MODE.D4.DIGITAL_OUTPUT_HIGH);
                // Only for testing purpose MCU+Xbee
                if(data.xbee === 'xbee3'){    //'123456789A123456789B123456789C123456789D123456789E123456789F123456789G123456789H123456789I123456789J'
                    xbee.ZBTransmitRequest(data.xbee, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
                    console.log(xbee.getXbeeWSNInfo());
                }
            }
            else{
                xbee.remoteATCmdReq(data.xbee, null, 'D4', C.PIN_MODE.D4.DIGITAL_OUTPUT_LOW);
                // Only for testing purpose MCU+Xbee
                if(data.xbee === 'xbee3'){
                    xbee.ZBTransmitRequest(data.xbee, 'off');
                }
            }
        }        

        console.log(dateTime() + "  Name: " + data.name + 
                    ",  Switch value: " + data.switchValue +
                    ",  AutoMode value: " + data.autoMode +
                    ",  AutoTime value: " + data.autoTime + ",  Pin: " + data.pin);

        // Broadcast new system state to everyone.
        io.emit('updateClients', data);
        // Broadcast new system state to everyone except for the socket that starts it.
        //socket.broadcast.emit('updateClients', data);


        // Start scheduler only if autoMode is 1 and device is off.
        // Pointless to start scheduler if device is already on.
        // Check that autoTime is not an empty string or undefined, otherwise server will stop working.
        if((data.switchValue === 0) && (data.autoMode === 1) && (data.autoTime !== "")){
            // Retrieve hours and minutes from client received data.
            var autoTimeSplit = data.autoTime.split(":");
            // First convert to integer: "02" -> 2. Then convert to string again: 2 -> "2".
            var hourStr = parseInt(autoTimeSplit[0], 10).toString();
            var minuteStr = parseInt(autoTimeSplit[1], 10).toString();

            // Set new scheduler values.
            var myCronTime = new cronTime('0 ' + minuteStr + ' ' + hourStr + ' * * *', null);
            schedulerJob[devId].setTime(myCronTime);
            schedulerJob[devId].setCallback(jobAutoOn.bind(this, devId));   // Set job/function to be execute on cron tick.
            schedulerJob[devId].start();
            console.log("Set Auto On to: " + schedulerJob[devId].nextDate() + "  " + data.name);
        }
        else if(schedulerJob[devId] instanceof cronJob) schedulerJob[devId].stop();

        // Store new values into json file systemState.json
        fs.writeFile(jsonFileName, JSON.stringify(jsonSystemState, null, 4), function (err) {
            if(err) console.log(err);
            //else console.log("JSON file saved at " + jsonFileName);
        });
    }   // updateSystemState() function end.
}           // function socketConnection() end.


// Xbee frame listener. The frame type determine which function is called.
//xbeeAPI.on("frame_object", xbeeFrameListener);
function xbeeFrameListener(frame){
    switch(frame.type){
        // AT Command Response.
        case 0x88: xbee.ATCmdResponse(frame); break;
        // ZigBee Transmit Status acknowledgement for the ZigBee Transmit Request.
        case 0x8B: xbee.ZBTransmitStatus(frame); break;
        // ZigBee Receive Packet handler for a remote ZigBee Transmit Request.
        case 0x90: xbee.ZBReceivePacket(frame); break;
        // ZigBee IO Data Sample Rx Indicator.
        case 0x92: xbee.ZBIODataSampleRx(frame); break;
        // After a Remote AT Cmd Request, module respond with a Remote AT Cmd Response.
        case 0x97: xbee.remoteCmdResponse(frame); break;
        // After a Many-to-One request, a Route Record Indicator will be received for each module.
        case 0xA1: xbee.routeRecordIndicator(frame); break;
        default:
            console.log("Not defined frame type: 0x" + frame.type.toString(16).toUpperCase());
            console.log(frame); break;
    }
}

// Update ThingSpeak database each 5 minutes.
setInterval(writeThingSpeak, 5*60*1000);
function writeThingSpeak(){
    // Create object with temperature averages.
    var fieldsUpdate = {
        field1: (xbee.sensorData['xbee1'].tempAccum/xbee.sensorData['xbee1'].sampleNum).toFixed(2),
        field2: (xbee.sensorData['xbee2'].tempAccum/xbee.sensorData['xbee2'].sampleNum).toFixed(2),
        field3: xbee.sensorData['xbee3'].t
    };
    //console.log(fieldsUpdate);
    thingspeak.updateChannel(11818, fieldsUpdate, function(err, resp){
        if(err || resp <= 0){
            return console.log('An error ocurred while updating ThingSpeak.');
        }
        else console.log('Update successfully. Entry number was: ' + resp);
    });
    
    // Restore sensorData object for new measurements.
    for(var xbeeKey in xbee.sensorDataAccum){
        xbee.sensorData[xbeeKey].tempAccum = 0;
        xbee.sensorData[xbeeKey].sampleNum = 0;
    }
}
