/*
    Client side script for handling admin tools in the WSN.
*/

$(document).on("pagecreate", function(){

    // Jquery variables.
    var $adminPanel = $('#adminPanel');
    var $connectionStatus = $('#connectionStatus');

    // Global variables.
    var guiActiveTime = 3*60*1000;  // Miliseconds.

    var socket = io.connect('pipobbb.mooo.com:8888',{
        rememberUpgrade: true,
        transports: ['xhr-polling', 'websocket', 'flashsocket', 'polling']
    });

    console.time('connection');    
    // Each time client connects/reconnects, it requests the system state to the server
    // Warning: maybe we have to include 'reconnect' event...
    socket.on('connect',function(){
        console.timeEnd('connection');

        console.log('Connect socket status: ', socket.io.engine);
        // Update connection status.
        $connectionStatus.text('Online');
		$connectionStatus.css('color', 'green');
        // When connection is established, enable all control elements if previously disabled.
        $adminPanel.removeClass("ui-state-disabled");

        // Disconnect from server after 'guiActiveTime' seconds. Reconnection occurs when user clicks on grayed background.        
        timerTimeout = null;
        timerTimeout = setTimeout(disconnectOnTimeout, guiActiveTime);

        // When client connects/reconnects, retrieve json file with the system state.
        socket.on('jsonWSN', function (jsonServerData){ 
            $adminPanel.empty();  // Empty the div.

    		// Create xbee remote AT command request gui form.
            var optionSelectString = '';
            // First option in the select input is broadcast the command to all xbees.
            optionSelectString += '<option value="broadcast">broadcast</option>';
            optionSelectString += '<option value="coordinator">coordinator</option>';
            for (var devId in jsonServerData) {
                if (jsonServerData[devId].type === 'xbee'){
                    var xbeeId = jsonServerData[devId].xbee;
                    optionSelectString += '<option value="' + xbeeId + '">' + xbeeId + '</option>';
                }
            }
    		$adminPanel.append(
    		'<div class="ui-field-contain" id="remoteATCmdReq-gui">\
    		    <select id="select-xbee" data-mini="true" data-inline="true">\
    		        ' + optionSelectString + '\
                </select>\
                <input type="text" id="text-xbee-cmd" value="" placeholder="Xbee Cmd" size="8">\
                <input type="text" id="text-xbee-param" value="" placeholder="Parameter" size="8">\
                <button class="ui-btn ui-btn-inline ui-mini ui-corner-all" id="xbee-cmd-send">Send</button>\
            </div>\
            <div id="frame-text-div">\
            </div>'
            );
            $adminPanel.trigger('create');
            $('#remoteATCmdReq-gui').find('.ui-select').addClass('horizontal-select'); // This way css can choose only this select input.
            $('#remoteATCmdReq-gui').find('.ui-input-text').addClass('horizontal-text'); // This way css can choose only this text inputs.
        });
    });
    
    // Handle local and remote AT command request gui interactions.
    $adminPanel.on('click', '#xbee-cmd-send', function () {
        var xbeeIdReq = $("#select-xbee option:selected").val()
        var xbeeCmdReq = $('#text-xbee-cmd').val();
        var xbeeParamReq = $('#text-xbee-param').val();
        var xbeeCmdObj = {'xbeeId': xbeeIdReq, 'xbeeCmd': xbeeCmdReq, 'xbeeParam': xbeeParamReq};
        socket.emit('xbeeClientCmdReq', xbeeCmdObj);  // Now client must wait for command response.
    });
    // Receive frame response from server to the remote AT command request gui.
    socket.on('cmdResponseFrame', function (frameResponse) {
        //console.log(JSON.stringify(frameResponse, null, 4));
        $('#frame-text-div').html('<pre><code>'+JSON.stringify(frameResponse, null, 4)+'</code></pre>');
    });

    // Update connection status.
    // Reasons: 'ping timeout', 'forced close', 'transport close'
    socket.on('disconnect', function(reason){
        $connectionStatus.text('Offline ' + reason);
		$connectionStatus.css('color', 'red');
		console.log('Disconnect socket status: ', socket.io.engine);
    });
    // Update connection status.
    socket.on('reconnect', function(){
        $connectionStatus.text('Reconnecting');
		$connectionStatus.css('color', '#2356e1');
		console.log('Reconnect socket status: ', socket.io.engine);
    });


    function disconnectOnTimeout(){
        // Close connection after # seconds.
        //socket.io.close();
        socket.io.disconnect();
        // Disable all control panel input elements. Grayed background. Re-enable it in reconnection.
        $adminPanel.addClass('ui-state-disabled');
    }
    $(window).on('click', function(){
        // If admin panel is disabled, clicking in grayed background return connection to server.
        if($adminPanel.hasClass('ui-state-disabled')){
            //console.log(socket);
            socket.io.connect();
        }
        // If control panel is available, then each click reset setTimeout's timer.
        // I.E. disconnection will occur # seconds after last click.
        else{
            clearTimeout(timerTimeout);
            timerTimeout = null;
            // Disconnect from server after 'guiActiveTime' seconds. Reconnection occurs when user clicks on grayed background.        
            timerTimeout = setTimeout(disconnectOnTimeout, guiActiveTime);
        }
    });
    //$(window).on('blur', windowBlur);
    $(window).on('focus', windowFocus);
    
    //$(window).blur(windowBlur);  // No se activa al cambiar de pagina internamente
    //$(window).focus(windowFocus);

    // Phone Chrome doesn't detect .blur() events, others browsers do. Waiting for some patches.
    function windowBlur(){
        // Clear timer to avoid another disconnection on timeout.
        clearTimeout(timerTimeout);
        timerTimeout = null;
        // On window losing focus, disconnect from server.
        socket.io.close();
        // Disable all control panel input elements. Grayed background. It will be re-enable in reconnection.
        $adminPanel.addClass('ui-state-disabled');
    }
    
    function windowFocus(){
        // If control panel is disabled, focus will try to reconnect.
        if ($adminPanel.hasClass('ui-state-disabled')) {
            socket.io.connect();
        }
    }
});
