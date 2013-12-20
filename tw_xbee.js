// Define some useful XBee constants
exports.START_BYTE = 0x7e;              // start of every XBee packet
// Frame Types
exports.FT_DATA_SAMPLE_RX = 0x83;       // I/O data sample packet received -- series 1 packet

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// ~~~~~~~~~~~~~~~~~~~~ INCOMING XBEE PACKETS ~~~~~~~~~~~~~~~~~~~~
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

exports.packetParser = function () {
  // A function which can be used with the 'serialport' npm package
  // and a XBee radio in API mode.
  // It builds a JS array of integers as data is received, and when the
  // array represents a complete XBee packet, it emits it as a 'data' event,
  // passing a JS object (as translated by packetToJS) instead of a load of numbers.

  // incoming data buffer saved in closure as a JS array of integers called 'packet'
  var packet = [];
  var packpos = 999; // this variable is used to remember at which position we are up to within the overall packet
  var packlen = 0;   // used to remember the length of the current packet.  XBee API packets have two length bytes immediately after the start byte

  return function (emitter, buffer) {
    // Collecting data. 'buffer' needs to be run through - it contains bytes received from the serial port
    // which may or may not represent an entire XBee packet.

    for(var i=0; i < buffer.length; i++) {
      b = buffer[i];    // store the working byte
      packpos += 1;     

      if (b == exports.START_BYTE) {
        // Detected start of packet.
        // exports.START_BYTE = 126, the start of a zigbee packet i.e. 0x7e
        packpos = 0;
        packlen = 0;  // length of packet is unknown, as yet.
        packet = [];  // store the bytes as they come in.  Don't keep start byte or length bytes
      }
      if (packpos == 1) {
        // most significant bit of the length
        packlen += b<<8;
      }
      if (packpos == 2) {
        // least significant bit of the length
        packlen += b;
      }

      // for all other bytes, collect them onto the end of our growing 'packet' array
      if ((packlen > 0) && (packpos > 2) && (packet.length < packlen)) {
        packet.push(b);
      }

      // emit the packet when it's fully built.  packlen + 3 = position of final byte
      if ((packlen > 0) && (packet.length == packlen) && (packpos == packlen + 3)) {
        // translate the packet into a JS object before emitting it
        emitter.emit("data", packetToJS(packet));
      }

      // there will still be a checksum byte.  Currently this is ignored
      if ((packlen > 0) && (packet.length == packlen) && (packpos > packlen + 3)) {
        // ignore checksum for now
      }
    }
  };
}

function range(start, stop, step){
    if (typeof stop=='undefined'){
        // one param defined
        stop = start;
        start = 0;
    };
    if (typeof step=='undefined'){
        step = 1;
    };
    if ((step>0 && start>=stop) || (step<0 && start<=stop)){
        return [];
    };
    var result = [];
    for (var i=start; step>0 ? i<stop : i>stop; i+=step){
        result.push(i);
    };
    return result;
};

function returnBool(element){
  if(element=="1"){
    return true;
  }else{
    return false;
  }
}

function analog_channel_count(s){
  return enabled_analog_channels(s).length;
}

function analog_channel_positions(s){
  var pos = (s.channel_indicator_high >> 1).toString(2).split("").map(returnBool)
  return pos;
}

function enabled_analog_channels(s){
  var channels = new Array;
  var enabed_channel_pos = analog_channel_positions(s)
  for(i=0; i<enabed_channel_pos.length; i++){
    if(enabed_channel_pos[i] == true){
      channels.push(i)
    }
  }
  return channels;
}

function load_analog_sample(s, sample_number){
  var ea_channels = enabled_analog_channels(s);
  var analog_sample_width = 2;
  var sample = [null, null, null, null, null, null];

  for(i=0; i<sample.length; i++){
    if(analog_channel_positions(s)[i] == true){
      // no digital data in this project, so ADC data starts at byte 8
      analog_data_start_position = 8;
      channel_offset_within_sample = ea_channels.indexOf(i) * analog_sample_width;
      sample_offset = ea_channels.length * sample_number * analog_sample_width
      dataADCMSB = s.bytes[analog_data_start_position + sample_offset + channel_offset_within_sample]
      dataADCLSB = s.bytes[analog_data_start_position + sample_offset + channel_offset_within_sample + 1]
      sample[i] = ((dataADCMSB << 8) + dataADCLSB)
    }
  }
  return sample;
}

function packetToJS(p) {
  // given an array of byte values, return a JS object representing the packet
  // the array of bytes excludes the start bit and the length bits (these are not collected by the serial parser funciton)
  // So, the first byte in the packet is the frame type identifier.
  if (p[0] == exports.FT_DATA_SAMPLE_RX) {
    s = {
      type: 'Data Sample',
      appId: p[0],
      addrMSB: p[1],
      addrLSB: p[2],
      address: p.slice(2,3),
      address_16: (p[1] << 8) + p[2],
      rssi: p[3],
      address_broadcast: (((p[4] >> 1) & 0x01) == 1),
      pan_broadcast: (((p[4] >> 2) & 0x01) == 1),
      total_samples: p[5],
      channel_indicator_high: p[6],
      channel_indicator_low: p[7], 
      local_checksum: parseInt(p[0], 16) + p[1] + p[2] + p[3] + p[4] + p[5] + p[6] + p[7],
      digital_samples: [],
      analog_samples: [],
      bytes: p
    }

    s.analog_channel_positions = analog_channel_positions(s);
    s.enabled_analog_channels = enabled_analog_channels(s);
    s.analog_channel_count = analog_channel_count(s);
    
    for(n in range(s.total_samples)){
      
      s.analog_samples.push(load_analog_sample(s, n));
      
    }

    return s;
  } else {
    // The first byte of the packet indicates it's an as-yet unknown frame type.
    // In this case, just return the bytes.
    return p;  
  }
}
