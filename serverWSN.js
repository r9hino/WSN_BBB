/*  
    Author: Philippe Ilharreguy
    Company: SET

    WSN control server using Node.js.

    To execute serverWSN.js as a deamon (bg process + logging) use:
    sudo nohup node serverWSN.js &>> server.log &

    Links:
    Cron library:   https://github.com/ncb000gt/node-cron/blob/master/lib/cron.js
    Closure issue:  http://conceptf1.blogspot.com/2013/11/javascript-closures.html
    Authentication: https://github.com/jaredhanson/passport-local/tree/master/examples/login
*/

// nodetime.com monitoring system.
require('nodetime').profile({
    accountKey: 'e54a03c529e0fcfa708e33d960d219579411194d', 
    appName: 'serverWSN.js'
});

var express = require('express');
var fs = require('fs');
/*var d = require('domain').create();
d.on('error', function(er){
    console.log(er);
    console.error(er);
    process.exit(1);
});
d.run(function(){*/
var Q = require('q');
var bbb = require('bonescript');
var cronJob = require('cron').CronJob;
var cronTime = require('cron').CronTime;
var SerialPort = require('serialport').SerialPort;
var xbee_api = require('/var/lib/cloud9/xbee-api');
var ThingSpeakClient = require('thingspeakclient');
var compression = require('compression');
var minify = require('express-minify');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var logger = require('morgan');
var expressSession = require('express-session');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var favicon = require('serve-favicon');
var flash = require('connect-flash');  

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
// Passport, Express and Routes configuration

// Passport strategy setting. It make use of users.js file.
require('./app_routes/initPassport')(passport);

//var app = require('./app_routes/app')();
var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(compression());
//app.use(minify({cache: __dirname + '/public/cache'}));
app.use(favicon(__dirname + '/public/images/favicon.ico'));
app.use(logger('dev'));
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(methodOverride());
app.use(expressSession({ secret: 'keyboard cat' , saveUninitialized: true,  resave: true }));
// Initialize Passport!  Also use passport.session() middleware, to support persistent login sessions (recommended).
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(__dirname + '/public', {
    etag: true,
    maxage: 0
}));

// Express routes definition.
var routes = require('./app_routes/routes')(passport, jsonSystemState);
app.use('/', routes);

//var app = require('./app_routes/app');
var server = app.listen(8888); 

//io.engine.transports = ['websocket', 'polling'];
var io = require('socket.io')(server, {
    pingInterval: 7000,
    pingTimeout: 16000,
    transports: ['polling', 'websocket', 'flashsocket', 'xhr-polling']
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

var xbee = new xbeeWSN.xbee(serialport, xbeeAPI, C);
console.log("Start WSN nodes discovery...");
xbee.remoteATCmdReq('broadcast', null, 'ND', '');   // Discover every node in the xbee network and store the 16bit address.

// Initialize local and remote devices.
//initDevices(jsonSystemState, bbb, xbee);

// Wait for node discovery to complete to initialize local and remote devices.    
setTimeout(function(){
    // Initialize local and remote devices.
    initDevices(jsonSystemState, bbb, xbee);
}, 10000);



//******************************************************************************
// Schedulers jobs initialization

// Two function initializer where create in order to avoid closure ambiguity.
var schedulerTime = {};
var schedulerJob = {};

function schedulerTimeInitialization(devId){
    return new cronTime('', null);
}
function schedulerJobInitialization(devId){
    return new cronJob('', function(){
        jsonSystemState[devId].switchValue = 1;
        // Depend on device type (pin or xbee), a different function will control the device.
        if (jsonSystemState[devId].type === 'pin')  bbb.digitalWrite(jsonSystemState[devId].pin, 1);
        else if (jsonSystemState[devId].type === 'xbee') xbee.remoteATCmdReq(jsonSystemState[devId].xbee, null, 'D4', C.PIN_MODE.D4.DIGITAL_OUTPUT_HIGH);
        
        console.log(dateTime() + '  Automatic on: ' + jsonSystemState[devId].name);
        io.sockets.emit('updateClients', jsonSystemState[devId]);
        // Store new values into json file systemState.json
        fs.writeFile(jsonFileName, JSON.stringify(jsonSystemState, null, 4), function(err){
            if(err) return console.log(err);
        });
    },
    null,   // Function execute after finishing the scheduler.
    false,  // Start the job right now true/false.
    null    // Timezone.
    );
}

for(var devId in jsonSystemState){
    schedulerTime[devId] = schedulerTimeInitialization(devId);
    schedulerJob[devId] = schedulerJobInitialization(devId);
}

//******************************************************************************
// Socket connection handlers
// Listen to changes made from the clients control panel.
io.on('connection', function(socket){
    var connectIP = socket.client.conn.remoteAddress;
    console.log(dateTime() + '  IP ' + connectIP + ' connected. Clients count: ' + io.eio.clientsCount);
    socket.on('disconnect', function(){
        var disconnectIP = socket.client.conn.remoteAddress;
        console.log(dateTime() + '  IP ' + disconnectIP + ' disconnected. Clients count: ' + io.eio.clientsCount);
    });
    
    // Send jsonSystemState data to client at the beginning of connection.
    socket.emit('jsonSystemState', jsonSystemState);
    
    // Listen for changes made by user on browser/client side. Then update system state.
    socket.on('elementChanged', updateSystemState);
    // Update system state based on clientData values sended by client's browsers.
    // clientData format is: {'id':devId, 'switchValue':switchValue, 'autoMode':autoMode, 'autoTime':autoTime}
    function updateSystemState (clientData){
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
                    xbee.displayXbeeNodes();
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
            // Retrieve hours and minutes from client sended data.
            var autoTimeSplit = data.autoTime.split(":");
            // First convert to integer: "02" -> 2. Then convert to string again: 2 -> "2".
            var hourStr = parseInt(autoTimeSplit[0], 10).toString();
            var minuteStr = parseInt(autoTimeSplit[1], 10).toString();

            // Set new scheduler values.
            schedulerTime[devId].source = '0 '+minuteStr+' '+hourStr+' * * *';
            schedulerTime[devId].hour = {};
            schedulerTime[devId].minute = {};
            schedulerTime[devId].hour[hourStr] = true;
            schedulerTime[devId].minute[minuteStr] = true;
            schedulerJob[devId].setTime(schedulerTime[devId]);
            console.log("Auto on: "+schedulerJob[devId].nextDate()+"  "+data.name);
            schedulerJob[devId].start();
        }
        else schedulerJob[devId].stop();

        // Store new values into json file systemState.json
        fs.writeFile(jsonFileName, JSON.stringify(jsonSystemState, null, 4), function (err) {
            if(err) console.log(err);
            //else console.log("JSON file saved at " + jsonFileName);
        });
    }   // updateSystemState() function end.





    // Listen for client xbee remote AT command request.
    socket.on('xbeeClientCmdReq', function(xbeeCmdObj){
        //console.log(xbeeCmdObj);
        var maxWait = 1500;
        
        // Handle custom command request from client browsers.
        // xbeeIdReq: Requested xbee id from client (broadcast, xbee1, xbee2...). 
        // xbeeCmdReq: Requested xbee cmd from client.
        function xbeeClientCmdHandler(xbeeIdReq, xbeeCmdReq, xbeeParamReq){
            var frameId = xbeeAPI.nextFrameId();
            // If xbeeIdReq is a broadcast signal or a remote xbee module, use remoteATCmdReq().
            if(xbeeIdReq !== 'coordinator') xbee.remoteATCmdReq(xbeeIdReq, frameId, xbeeCmdReq, xbeeParamReq);
            else xbee.ATCmdReq(frameId, xbeeCmdReq, xbeeParamReq);  // If coordinator was selected, send a local cmd req.

            // We're going to return a promise and handle ATCmdReq and remoteATCmdReq response when they arrive.
            var deferred = Q.defer();

            // Attach callback and wait for the deferred response.
            xbeeAPI.on("frame_object", callback);            
            function callback(receivedFrame){
                if(receivedFrame.id === frameId){
                    receivedFrame.type = '0x' + receivedFrame.type.toString(16);
                    receivedFrame.xbeeId = xbee.getXbeeKeyByAddress64(receivedFrame.remote64);
                    receivedFrame.commandData = '[' + receivedFrame.commandData.toString() + ']';
                    // This is our frame's response. Resolve the promise.
                    deferred.resolve(receivedFrame);
                }
            };

            // There could be multiple responses when using a broadcasted cmd, so maxWait must be incremented.
            if(xbeeIdReq === 'broadcast') maxWait = maxWait + 2000;
            // Clear up: remove listener after the timeout and a bit, it's no longer needed.
            // This way we avoid having multiple xbeeAPI.on() listener (avoid memory leak).
            setTimeout(function(){
                xbeeAPI.removeListener("frame_object", callback);
            }, maxWait + 100);

            // If maxWait milisecond pass without a resolve, the promise will be rejected.
            return deferred.promise.timeout(maxWait);
        }

        xbeeClientCmdHandler(xbeeCmdObj.xbeeId, xbeeCmdObj.xbeeCmd, xbeeCmdObj.xbeeParam)
        .then(function(frame){
            socket.emit('cmdResponseFrame', frame);
        }).catch(function(e){
            console.log("Command failed:", e);
        });
    });     // socket.on('xbeeClientCmdReq', function(xbeeCmdObj){}) end.
});         // io.on('connection', function(socket){}) end.


// Xbee frame receiver. The frame type determine which function is called.
xbeeAPI.on("frame_object", function(frame){
    switch (frame.type){
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
        default:
            console.log("Not defined frame type: 0x" + frame.type.toString(16));
            console.log(frame); break;
    }
});

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
            console.log('An error ocurred while updating ThingSpeak.');
        }
        // else console.log('Update successfully. Entry number was: ' + resp);
    });
    
    // Restore sensorData object for new measurements.
    for(var xbeeKey in xbee.sensorDataAccum){
        xbee.sensorData[xbeeKey].tempAccum = 0;
        xbee.sensorData[xbeeKey].sampleNum = 0;
    }
}

process.on('uncaughtException', function(er){
  console.error(er.stack);
  console.log(er.stack);
  process.exit(1);
});


//});//d domain