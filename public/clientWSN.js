
/*
    Client side script for handling WSN devices.
*/

$(document).ready(function(){
    var socket = io.connect();

    // When ready page loading, retrieve json file with the system state
    $.getJSON("/getSystemState/", function(jsonServerData){
        $('#controlPanel').empty();  // Empty the div

        var j = 0;
		for (var key in jsonServerData) {
		    var name = jsonServerData[key].name;
		    var value = jsonServerData[key].value;
		    
		    // Create buttons based on the system state
		    $('#controlPanel').append(
				'<div id="radiogroup'+j+'" data-role="fieldcontain">\
					<fieldset data-role="controlgroup" data-type="horizontal" data-mini="true">\
					<legend>'+name+'</legend>\
					<input type="radio" name="PB'+j+'" id="PB'+j+'1" checked="checked"/>\
					<label class="dynamicButton" name="PB'+j+'" value=1 for="PB'+j+'1">On</label>\
					<input type="radio" name="PB'+j+'" id="PB'+j+'2" />\
					<label class="dynamicButton" name="PB'+j+'" value=0 for="PB'+j+'2">Off</label>\
					</fieldset>\
				</div>'
			);

			$('#controlPanel').trigger('create');

			if (value === 1){$('#PB'+j+'1').prop("checked",true).checkboxradio( "refresh" );}
			else{$('#PB'+j+'1').prop("checked",false).checkboxradio( "refresh" );}

			if (value === 0){$('#PB'+j+'2').prop("checked",true).checkboxradio( "refresh" );}
			else{$('#PB'+j+'2').prop("checked",false).checkboxradio( "refresh" );}        

			j++;		
		}
    });
    
    // Handle clicks on dynamically created buttons. Send new states to server.
    $('#controlPanel').on('click','.dynamicButton', function() {
        console.log($(this).attr('name'), $(this).attr('value'));
        var id = $(this).attr('name');
        var value = $(this).attr('value');
        //console.log(str);
        socket.emit('buttonPress', '{"id":"'+id+'", "value":'+value+'}');
    });

});
