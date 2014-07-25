
/*
    Client side script for handling WSN devices.
*/

$(document).ready(function(){
    var socket = io.connect();

    // When page loading is ready, retrieve json file with the system state.
    $.getJSON("/getSystemState/", function(jsonServerData){
        $('#controlPanel').empty();  // Empty the div

        for (var pbId in jsonServerData) {
		    var name = jsonServerData[pbId].name;
		    var value = jsonServerData[pbId].value;
		    
		    // Create buttons based on the system state.
		    $('#controlPanel').append(
				'<div id="'+pbId+'Radiogroup" data-role="fieldcontain">\
					<fieldset data-role="controlgroup" data-type="horizontal" data-mini="true">\
					<legend>'+name+'</legend>\
					<input type="radio" name="'+pbId+'" id="'+pbId+'1" checked="checked"/>\
					<label class="dynamicButton" name="'+pbId+'" value=1 for="'+pbId+'1">On</label>\
					<input type="radio" name="'+pbId+'" id="'+pbId+'2" />\
					<label class="dynamicButton" name="'+pbId+'" value=0 for="'+pbId+'2">Off</label>\
					</fieldset>\
				</div>'
			);

			$('#controlPanel').trigger('create');

			if (value === 1){$('#'+pbId+'1').prop("checked",true).checkboxradio("refresh");}
			else{$('#'+pbId+'1').prop("checked",false).checkboxradio("refresh");}

			if (value === 0){$('#'+pbId+'2').prop("checked",true).checkboxradio("refresh");}
			else{$('#'+pbId+'2').prop("checked",false).checkboxradio("refresh");}
		}
    });
    
    // Handle clicks on dynamically created buttons. Send new states to server.
    // Care must be taken in the future, because click handler is based on 
    // labels and not on inputs (check .dynamicButton).
    $('#controlPanel').on('click','.dynamicButton', function() {
        // "this" correspond to the label tag clicked
        console.log($(this).attr('name'), $(this).attr('value'));
        var pbId = $(this).attr('name');    // PB0, PB1, etc.
        var value = parseInt($(this).attr('value'));
        
        socket.emit('buttonPress', {"id":pbId, "value":value});
    });

    // Update client control panel do to changes in others client's the control panel
    socket.on('updateClients', function (othersClientsData) {
        console.log(othersClientsData);
        var pbId = othersClientsData.id;
        var value = othersClientsData.value;

		if (value === 1){$('#'+pbId+'1').prop("checked",true).checkboxradio("refresh");}
		else{$('#'+pbId+'1').prop("checked",false).checkboxradio("refresh");}

		if (value === 0){$('#'+pbId+'2').prop("checked",true).checkboxradio("refresh");}
		else{$('#'+pbId+'2').prop("checked",false).checkboxradio("refresh");}        
    });
});
