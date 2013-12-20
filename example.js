
var rsp = require("serialport");
var xbee = require("./tw_xbee");
var SerialPort = rsp.SerialPort; // localize object constructor

if (process.platform == 'darwin') {
  portName = '/dev/cu.usbserial-FTFO9K4V';
} else {
  portName = '/dev/ttyUSB0';
}

var serialport = new SerialPort(portName, { 
  parser: xbee.packetParser()
});

var TweetawattSensor = require("./tw_sensor").TweetawattSensor;

serialport.on("data", function(data) {
  var sensor = new TweetawattSensor(data);
  
  // console.log(sensor);
  console.log("From: " + sensor.address + " Recieved: ", sensor.type + "");
  console.log("  avgamp: " + sensor.avgamp);
  console.log("  avgwatt: " + sensor.avgwatt);
});
