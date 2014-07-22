
/*
    Client side script for handling WSN devices.
*/

var socket = io.connect();
        
socket.on('ledstatus', function (data) {
    console.log(data);
    $("body").css("background-color", data);
});
        
function ledOn(){
    socket.emit('digitalWrite', '{"pin":"P8_10", "value":1}');
}

function ledOff(){
    socket.emit('digitalWrite', '{"pin":"P8_10", "value":0}');
}

$(document).ready(function(e){});
