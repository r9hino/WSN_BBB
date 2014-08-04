function getDateTime() {

    var date = new Date();

    var hmsTime = date.toLocaleTimeString();
    
    var year = date.getFullYear();

    var month = date.getMonth() + 1;
    month = (month < 10 ? "0" : "") + month;

    var day  = date.getDate();
    day = (day < 10 ? "0" : "") + day;

    return day + "/" + month + "/" + year + " " + hmsTime;
}

exports.getDateTime = getDateTime;