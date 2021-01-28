// Create server
let port = process.env.PORT || 8000;
let express = require('express');
let osc = require('osc')
let app = express();
let server = require('http').createServer(app).listen(port, function () {
  console.log('Server listening at port: ', port);
});

// Tell server where to look for files
app.use(express.static('public'));

// Create socket connection
let io = require('socket.io').listen(server);

let oscPort = new osc.UDPPort({
  localAddress: "0.0.0.0",
  localPort: 57121,
  // This is where sclang is listening for OSC messages.
  remoteAddress: "127.0.0.1",
  remotePort: 57120,
});

let oscPortReady = false;

oscPort.open();
oscPort.on("error", function (error) {
    console.log("An error occurred: ", error.message);
});
oscPort.on("ready", function () {
  console.log("Osc port ready!")
  oscPortReady = true;
});

// Listen for individual clients to connect
io.sockets.on('connection',
  // Callback function on connection
  // Comes back with a socket object
  function (socket) {
    console.log("We have a new client: " + socket.id);
    // Listen for data from this client
    socket.on('midi', function(data) {
          oscPort.send({
          address: "/planet_control/midi",
          args: [{
              type: "i",
              value: parseInt(data.midiNote)
          }, {
            type: "i",
            value: parseInt(data.midiVel)
          }]
        });
    });
    socket.on('data', function(data) {
      // Data can be numbers, strings, objects
      //console.log("Received: 'data' " + JSON.stringify(data));
      if (oscPortReady) {
        oscPort.send({
            address: "/planet_control/volume",
            args: [{
                type: "i",
                value: parseInt(data.volume)
            }]
        }); 
        oscPort.send({
            address: "/planet_control/osc1freq",
            args: [{
                type: "i",
                value: parseInt(data.osc1freq)
            }]
        }); 
        oscPort.send({
            address: "/planet_control/osc2freq",
            args: [{
                type: "i",
                value: parseInt(data.osc2freq)
            }]
        });
        oscPort.send({
            address: "/planet_control/osc3freq",
            args: [{
                type: "i",
                value: parseInt(data.osc3freq)
            }]
        });
        oscPort.send({
          address: "/planet_control/filterfreq",
          args: [{
              type: "i",
              value: parseInt(data.filterfreq)
          }]
        });
      }
   
    });

    // Listen for this client to disconnect
    socket.on('disconnect', function() {
        console.log("Client has disconnected " + socket.id);
    });
  }
);
