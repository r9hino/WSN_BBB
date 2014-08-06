/*
    Client side script for handling WSN devices.
*/

$(document).ready(function(){
    var socket = io.connect();

    // Each time client connects/reconnects, it requests the system state to the server
    // Warning: maybe we have to include 'reconnect' event...
    socket.on('connect',function(){
        // When client connects/reconnects, retrieve json file with the system state.
        $.getJSON("/getSystemState/", function(jsonServerData){
            $('#controlPanel').empty();  // Empty the div
    
            for (var pbId in jsonServerData) {
    		    var name = jsonServerData[pbId].name;
    		    var value = jsonServerData[pbId].value;
    		    var autoMode = jsonServerData[pbId].autoMode;

    		    // Create buttons based on the system state.
    		    $('#controlPanel').append(
    			'<div id="'+pbId+'Radiogroup" data-role="fieldcontain">\
    				<fieldset data-role="controlgroup" data-type="horizontal" data-mini="true">\
    				<legend>'+name+'</legend>\
    				<input type="radio" class="dynamicButton" name="'+pbId+'" value=1 id="'+pbId+'1" checked="checked"/>\
    				<label for="'+pbId+'1">On</label>\
    				<input type="radio" class="dynamicButton" name="'+pbId+'" value=0 id="'+pbId+'2" />\
    				<label for="'+pbId+'2">Off</label>\
                    </fieldset>\
    			</div>\
    			<input type="checkbox" class="dynamicCheckBox" name="'+pbId+'" id="'+pbId+'checkbox" data-mini="true">\
                <label for="'+pbId+'checkbox">Auto On</label>'
    			);

    			$('#controlPanel').trigger('create');

    			updateDynamicallyAddedButtons(pbId, value, autoMode);
    		}
        });
    });

    // Send data.
    // Use .on() method when working with dynamically created buttons
    // Handles clicks/changes on dynamically created buttons. Send new states to server.
    $('#controlPanel').on('change','.dynamicButton', function() {
        // "this" correspond to the input radio button clicked/changed.
        var pbId = $(this).attr('name');    // PB0, PB1, etc.
        var value = parseInt($(this).attr('value'));

        // Send button state to server.
        //console.log("This client data: ", {"id":pbId, "value":value})
        socket.emit('buttonPress', {"id":pbId, "value":value});
    });
    
    // Handles selection on dynamically added checkboxes. Send new states to server.
    $('#controlPanel').on('change', '.dynamicCheckBox', function() {
        // "this" correspond to the input radio button clicked/changed.
        var pbId = $(this).prop('name');    // PB0, PB1, etc.
        var value = $(this).prop('checked') ? 1 : 0;    // If checked set value to 1.

        // Send checkbox state to server.
        //console.log("This client data: ", {"id":pbId, "value":value})
        socket.emit('checkBoxPress', {"id":pbId, "autoMode":value});
    });

    /* Receive data.
       Update client control panel do to changes in others client's control panel.
    
       Also used as feedback from the server. Client --> Server --> Client.
       Client send new states to server, and if server did the work, it send back
       again the system state values as a confirmation procedure.
    */
    socket.on('updateClients', function (serverData) {
        console.log("Data from server: ", serverData);
        var pbId = serverData.id;
        var value = serverData.value;
        var autoMode = serverData.autoMode;

        updateDynamicallyAddedButtons(pbId, value, autoMode);
    });

    // Update buttons colors when selected.
    function updateDynamicallyAddedButtons(pbId, value, autoMode){
        if (value === 1){$('#'+pbId+'1').prop("checked",true).checkboxradio("refresh");}
		else{$('#'+pbId+'1').prop("checked",false).checkboxradio("refresh");}

		if (value === 0){$('#'+pbId+'2').prop("checked",true).checkboxradio("refresh");}
		else{$('#'+pbId+'2').prop("checked",false).checkboxradio("refresh");}
		
		if (autoMode === 1) $('#'+pbId+'checkbox').prop("checked",true).checkboxradio("refresh");
		else $('#'+pbId+'checkbox').prop("checked",false).checkboxradio("refresh");
    }
    
    // Check if client has connection with the server each interval of time.
    setInterval(isClientConnected, 1500);
    function isClientConnected () {
        //console.log(socket);
        // If client has an active connection with the server, display the online status.
        if(socket.connected) {
            $('#connectionStatus').text('Online');
		    $('#connectionStatus').css('color', 'green');
        }
        else {
            $('#connectionStatus').text('Offline');
		    $('#connectionStatus').css('color', 'red');
        }
    };
    
});
