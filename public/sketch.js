let audioContext;
let spectrum = 'powerSpectrum'
let features = {
    'spectralCentroid': 0,
    'spectralFlatness': 0,
    'rms': 0,
};
features[spectrum] = []
let FFTSIZE = 1024
let G = 0.1
let GRIDSIZE = 4
let analyzer, mic;
let socket = io()

socket.on('connect', function() {
    console.log('connected')
})

let planets = new PlanetSystem(G, GRIDSIZE)

/* Input: global variable features <- meyda audio features
 * returns: nothing
 * action: add planets from audio features
 */
function addPlanets() {
    //let x = features['spectralCentroid']
    let y = features['spectralFlatness']
    let v = features['rms']
    for (let i = 0; i < features[spectrum].length; i++) {
        let lfreq = Math.log(i)
        const p = 128
        if (features[spectrum][i] > 0.01) {
            planets.add_fixed_mass(
                map(lfreq, 0, Math.log(features[spectrum].length), p, 1024 - p),
                map(y, 0, 0.5, p * 2, 1024 - p * 2),
                Math.sqrt(features[spectrum][i]),
            )
        }
    }
}

let oscWebSocket

function onSocketOpen(socket) {
    console.log('socket opened')
}

function onSocketMessage(socket) {
    console.log('socket received a message')
}

function setup() {
    //planets.add_planet(new Planet(100, 100, 10, 'grey'))
    planets.add_planet(new Planet(512, 512, 16, 'grey', 0, -0.5))
    createCanvas(1024, 1024) 
    frameRate(30);
    /*
    oscWebSocket = new osc.WebSocketPort({
        url: "ws://127.0.0.1:12345",
        metadata: true
    });
    oscWebSocket.on("ready", onSocketOpen);
    oscWebSocket.on("message", onSocketMessage);;
    oscWebSocket.open()
    */
}

function draw() {
    background(color('rgba(255, 250, 240, 0.1)'));
    planets.draw()
    planets.step()
    planets.sendOsc()
}

function mousePressed() {
    userStartAudio();
    setupAudio();
}

/* MEYDA SETUP */

function createAudioCtx() {
    let AudioContext = window.AudioContext || window.webkitAudioContext;
    return new AudioContext();
}

function createMicSrcFrom(audioCtx) {
    return new Promise((resolve, reject) => {
        /* get microphone access */
        navigator.mediaDevices.getUserMedia({
            audio: true
        }).then((stream) => {
            /* create source from microphone input stream */
            let src = audioCtx.createMediaStreamSource(stream);
            resolve(src);
        }).catch((err) => {
            reject(err)
        });
    });
}

function setupMeydaAnalzer(ctx) {
    createMicSrcFrom(ctx).then((src) => {
        analyzer = Meyda.createMeydaAnalyzer({
            'audioContext': ctx,
            'source': src,
            'bufferSize': FFTSIZE,
            'featureExtractors': [
              "chroma",
              "spectralCentroid",
              "spectralFlatness",
              spectrum,
              "rms",
            ],
            'callback': callback
        });
        analyzer.start();
    }).catch((err) => {
        alert(err);
    })
}

function callback(features_) {
    features = features_
    addPlanets()
}


function setupAudio() {
    console.log("Setting up audio")
    userStartAudio();
    let ctx = getAudioContext()
    setupMeydaAnalzer(ctx)
}