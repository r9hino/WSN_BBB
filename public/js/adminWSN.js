/*
    Client side script for handling admin tools in the WSN.
*/

$(document).on("pagecreate", function(){
    // Jquery variables.
    var $adminPanel = $('#adminPanel');
    var $cmdReqPanel = $('#cmdReqPanel');
    var $xbeeWSNInfoPanel = $('#xbeeWSNInfoPanel');
    var $connectionStatus = $('#connectionStatus');

    // Global variables.
    var guiActiveTime = 3*60*1000;  // Miliseconds.

    var socket = io.connect('pipobbb.mooo.com:8888',{
        rememberUpgrade: true,
        transports: ['xhr-polling', 'websocket', 'flashsocket', 'polling']
    });

    // Check system speed for concluding socket connection.
    console.time('connection');    
    // Each time client connects/reconnects, toggle grayed GUI.
    socket.on('connect',function(){
        console.timeEnd('connection');
        console.log('Connect socket status: ', socket.io.engine);

        // Enable graphical user interface GUI.
        enableGUI();
    });

    // Display input buttons for command request.
    // System state is received only one time.
    socket.once('jsonSystemState', createCmdReqPanel);
    function createCmdReqPanel(jsonServerData){ 
        $cmdReqPanel.empty();  // Empty the div.

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
        // Add inputs to the web.
		$cmdReqPanel.append(
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
        $cmdReqPanel.trigger('create');
        $('#remoteATCmdReq-gui').find('.ui-select').addClass('horizontal-select'); // This way css can choose only this select input.
        $('#remoteATCmdReq-gui').find('.ui-input-text').addClass('horizontal-text'); // This way css can choose only this text inputs.
    }
    
    // Handle local and remote AT command request gui interactions.
    $cmdReqPanel.on('click', '#xbee-cmd-send', function(){
        var xbeeIdReq = $("#select-xbee option:selected").val()
        var xbeeCmdReq = $('#text-xbee-cmd').val();
        var xbeeParamReq = $('#text-xbee-param').val();
        var xbeeCmdObj = {'xbeeId': xbeeIdReq, 'xbeeCmd': xbeeCmdReq, 'xbeeParam': xbeeParamReq};
        socket.emit('clientXbeeCmdReq', xbeeCmdObj);  // Now client must wait for command response.
    });


    // Retrieve Xbees/Nodes network info (routes, addresses, devices down) and crate a table.
    socket.once('jsonXbeeWSNInfo', function(jsonXbeeWSNInfo){
        // All table html code is implemented in javascript to avoid problem with table 
        // responsiveness (columntoggle). Problem when mixing static html parts and dynamic added parts.
        var tableString = '';
        tableString += '<table data-role="table" data-column-btn-text="Columns to display" data-mode="columntoggle" class="reference ui-responsive ui-shadow table-stroke" id="adminTable">';
            tableString += '<thead><tr>';
            tableString += '<th id="th1">Xbee Source</th>';
            tableString += '<th id="th2" data-priority="1">Routes</th>';
            tableString += '<th id="th3" data-priority="2">16bit Addr</th>';
            tableString += '<th id="th4" data-priority="3">32bit Addr</th>';
            tableString += '</tr></thead>';
        tableString += '<tbody id="tbody-admin">';
                    
        for (var xbeeKey in jsonXbeeWSNInfo.networkRoutes) {
            var route = jsonXbeeWSNInfo.networkRoutes[xbeeKey].toString();
            var addr16 = jsonXbeeWSNInfo.addrXbee16[xbeeKey];
            var addr64 = jsonXbeeWSNInfo.addrXbee64[xbeeKey].slice(8);  // Only the LSB.
            tableString += '<tr>';
            tableString += '<td>'+xbeeKey+'</td>';
            tableString += '<td>'+route+'</td>';
            tableString += '<td>'+'0x'+addr16+'</td>';
            tableString += '<td>'+'0x'+addr64+'</td>';
            tableString += '</tr>';
        }
        tableString += '</tbody>';
        tableString += '</table>';
        $xbeeWSNInfoPanel.append(tableString);
        //$("#adminTable-popup-popup").remove();
        //$('#adminTable').table();
        $xbeeWSNInfoPanel.trigger('create');
        //$xbeeWSNInfoPanel.html(tableString).enhanceWithin();
    });

    // Update connection status.
    // Reasons: 'ping timeout', 'forced close', 'transport close'
    socket.on('disconnect', function(reason){
        $connectionStatus.text('Offline ' + reason);
		$connectionStatus.css('color', 'red');
    });
    // Update connection status.
    socket.on('reconnect', function(){
        $connectionStatus.text('Reconnecting');
		$connectionStatus.css('color', '#2356e1');
    });

    $(window).on('click', function(){
        // If admin panel is disabled, clicking in grayed background return connection to server.
        if($adminPanel.hasClass('ui-state-disabled')){
            socket.io.skipReconnect = false;
            socket.io.reconnect();
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
        socket.io.disconnect();
        // Disable all control panel input elements. Grayed background. It will be re-enable in reconnection.
        $adminPanel.addClass('ui-state-disabled');
    }
    
    function windowFocus(){
        // If control panel is disabled, focus will try to reconnect.
        if ($adminPanel.hasClass('ui-state-disabled')){
            socket.io.skipReconnect = false;
            socket.io.reconnect();
        }
    }
    
    function enableGUI(){
        // Update connection status.
        $connectionStatus.text('Online');
		$connectionStatus.css('color', 'green');
        // When connection is established, enable all control elements if previously disabled.
        $adminPanel.removeClass("ui-state-disabled");

        // Disconnect from server after 'guiActiveTime' seconds. Reconnection occurs when user clicks on grayed background.        
        timerTimeout = null;
        timerTimeout = setTimeout(disconnectOnTimeout, guiActiveTime);
    }
    
    function disconnectOnTimeout(){
        // Close connection after # seconds.
        socket.io.disconnect();
        // Disable all control panel input elements. Grayed background. Re-enable it in reconnection.
        $adminPanel.addClass('ui-state-disabled');
    }
});
