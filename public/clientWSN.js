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
    
            for (var devId in jsonServerData) {
    		    var name = jsonServerData[devId].name;
    		    var switchValue = jsonServerData[devId].switchValue;
    		    var autoMode = jsonServerData[devId].autoMode;

    		    // Create buttons based on the system state.
    		    $('#controlPanel').append(
                '<div class="ui-field-contain">\
                    <input type="checkbox" class="dynamic" name="'+devId+'" id="'+devId+'switch" data-role="flipswitch">\
                        <label for="'+devId+'switch" class="inline">'+name+'</label>\
                    <input type="checkbox" class="dynamic" name="'+devId+'" id="'+devId+'checkbox" data-mini="true">\
                        <label for="'+devId+'checkbox" class="inline">Auto On</label>\
                </div>'
    			);

    			$('#controlPanel').trigger('create');

    			updateDynamicallyAddedButtons(devId, switchValue, autoMode);
    		}
        });
    });


    // Send data.
    // Use .on() method when working with dynamically created buttons.
    // Handles clicks/changes events and send new states to server.
    $('#controlPanel').on('change', '.dynamic', changeHandler);
    function changeHandler (e) {
        // "this" correspond to the input radio button clicked/changed.
        var devId = $(this).prop('name');    // PB0, PB1, etc.
        var switchValue = $('#'+devId+'switch').prop('checked') ? 1 : 0;  // If switch is on set switchValue to 1.
        var autoMode = $('#'+devId+'checkbox').prop('checked') ? 1 : 0;   // If checked is true set value to 1.

        // Send button state to server.
        console.log('This client data: ', {'id':devId, 'switchValue':switchValue, 'autoMode':autoMode})
        socket.emit('elementChanged', {'id':devId, 'switchValue':switchValue, 'autoMode':autoMode});
    }
    

    /* Receive data.
       Update client control panel do to changes in others client's control panel.
       Also used as feedback from the server. Client --> Server --> Client.
       Client send new states to server, and if server did the work, it send back
       again the system state values as a confirmation procedure.
    */
    socket.on('updateClients', function (serverData) {
        console.log("Data from server: ", serverData);
        var devId = serverData.id;
        var switchValue = serverData.switchValue;
        var autoMode = serverData.autoMode;

        updateDynamicallyAddedButtons(devId, switchValue, autoMode);
    });


    // Update buttons colors when selected.
    function updateDynamicallyAddedButtons(devId, switchValue, autoMode){
        $('#controlPanel').off();

        // Turn on or off switch checkbox.
        if (switchValue === 1)  $('#'+devId+'switch').prop("checked",true).flipswitch("refresh");
        else  $('#'+devId+'switch').prop("checked",false).flipswitch("refresh");

        
		// Check or uncheck Auto Mode checkbox.
		if (autoMode === 1) $('#'+devId+'checkbox').prop("checked",true).checkboxradio("refresh");
		else $('#'+devId+'checkbox').prop("checked",false).checkboxradio("refresh");
		
		// Reactivate on 'change' event handler. This way we avoid reentering to 
		// on 'change' event handler after each 'refresh'. Event handler must be 
		// execute only by manually action an not due to program actions, like when refreshing.
		$('#controlPanel').on('change', '.dynamic', changeHandler);
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

/*
 // Create buttons based on the system state.
    		    $('#controlPanel').append(
    			'<div id="'+devId+'Radiogroup" data-role="fieldcontain">\
    				<fieldset data-role="controlgroup" data-type="horizontal" data-mini="true">\
    				<legend>'+name+'</legend>\
    				<input type="radio" class="dynamicButton" name="'+devId+'" value=1 id="'+devId+'1" checked="checked"/>\
    				<label for="'+devId+'1">On</label>\
    				<input type="radio" class="dynamicButton" name="'+devId+'" value=0 id="'+devId+'2" />\
    				<label for="'+devId+'2">Off</label>\
                    </fieldset>\
    			</div>\
    			<input type="checkbox" class="dynamicCheckBox" name="'+devId+'" id="'+devId+'checkbox" data-mini="true">\
                <label for="'+devId+'checkbox">Auto On</label>'
    			);
*/

    // Handles selection on dynamically added checkboxes. Send new states to server.
    /*$('#controlPanel').on('change', '.dynamicCheckBox', function() {
        // "this" correspond to the input checkbox clicked/changed.
        var devId = $(this).prop('name');    // PB0, PB1, etc.
        var switchValue = $('#'+devId+'switch').prop('checked') ? 1 : 0;
        var autoMode = $(this).prop('checked') ? 1 : 0;   // If checked is true set value to 1.

        // Send checkbox state to server.
        console.log('This client data: ', {'id':devId, 'switchValue':switchValue, 'autoMode':autoMode})
        socket.emit('checkBoxPress', {'id':devId, 'switchValue':switchValue, 'autoMode':autoMode});
    });
*/