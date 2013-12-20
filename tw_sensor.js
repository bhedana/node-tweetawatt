exports.TweetawattSensor = function(xbee_data_packet) { 
  var data = xbee_data_packet;
  
  var VOLTSENSE = 0 // which XBee ADC has mains voltage data
  var CURRENTSENSE = 4 // which XBee ADC has current draw data

  var MAINSVPP = (170 * 2) // +-170V is what 120Vrms ends up being (= 120*2sqrt(2))

  // hard coding calibration data is not very neat or a sustainable practice
  // find a better way
  var VREFCALIBRATION = []
  VREFCALIBRATION[1] = 492 // Calibration for sensor #1
  VREFCALIBRATION[2] = 475 // Calibration for sensor #2
  VREFCALIBRATION[3] = 481 // Calibration for sensor #3
  VREFCALIBRATION[4] = 500 // Calibration for sensor #4
  // etc... approx ((2.4v * (10Ko/14.7Ko)) / 3
  
  var CURRENTNORM = 15.5  // conversion to amperes from ADC

  var avgamp = 0;
  var avgwatt = 0;
  var voltagedata = [];
  var ampdata = [];
  var wattdata = [];

  round = function(rnum){
    return Math.round(rnum*Math.pow(10,2))/Math.pow(10,2);
  }
  
  parseSamples = function(){
    for(i=0; i<data.analog_samples.length; i++){
      voltagedata[i] = data.analog_samples[i][VOLTSENSE]
      ampdata[i] = data.analog_samples[i][CURRENTSENSE]    
    }

    // get max and min voltage and normalize the curve to '0'
    // to make the graph 'AC coupled' / signed
    var min_v = 1024 // XBee ADC is 10 bits, so max value is 1023
    var max_v = 0

    for(i=0; i<voltagedata.length; i++){
      if(min_v > voltagedata[i]){
        min_v = voltagedata[i] 
      }
      if(max_v < voltagedata[i]){
        max_v = voltagedata[i] 
      }
    }

    // figure out the 'average' of the max and min readings
    avgv = (max_v + min_v) / 2
    // also calculate the peak to peak measurements
    vpp =  max_v-min_v

    for(i=0; i<voltagedata.length; i++){
      // remove 'dc bias', which we call the average read
      voltagedata[i] -= avgv
      // We know that the mains voltage is 120Vrms = +-170Vpp
      voltagedata[i] = round((voltagedata[i] * MAINSVPP) / vpp)
    }

    // normalize current readings to amperes
    for(i=0; i<ampdata.length; i++){
      // VREF is the hardcoded 'DC bias' value, its
      // about 492 but would be nice if we could somehow
      // get this data once in a while maybe using xbeeAPI
      if(VREFCALIBRATION[data.address]){
        ampdata[i] -= VREFCALIBRATION[data.address]
      }else{
        ampdata[i] -= VREFCALIBRATION[0]
      }
      // the CURRENTNORM is our normalizing constant
      // that converts the ADC reading to Amperes
      ampdata[i] = Math.abs(round(ampdata[i] / CURRENTNORM))
      // calculate instant. watts, by multiplying V*I for each sample point
      wattdata[i] = Math.abs(round(voltagedata[i] * ampdata[i]))
    }
    
    
    // sum up the current drawn over one 1/60hz cycle
    // 16.6 samples per second, one cycle = ~17 samples
    // close enough for govt work :(
    for(i=0; i<17; i++){
      avgamp += ampdata[i]
      avgwatt += wattdata[i]
    }
    avgamp = round(avgamp / 17.0)
    avgwatt = round(avgwatt / 17.0)
  },
    
  parseSamples();
  data.avgamp = avgamp;
  data.avgwatt = avgwatt;
  
  return data;
};

