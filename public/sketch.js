let audioContext;
let spectrum = 'powerSpectrum'
let features = {
    'spectralCentroid': 0,
    'rms': 0,
};
features[spectrum] = []
let FFTSIZE = 1024
let G = 0.15
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
    let x = features['perceptualSpread']
    let y = Math.log(features['spectralCentroid'] + 1)
    let v = features['rms']
    const p = 64
    /*
    planets.add_fixed_mass(
        map(y, 0, Math.log(FFTSIZE / 2), p, 1024-p),
        map(x, 0, 1, p * 2, 1024 - p * 2),
        v * 1024
    )
    */
    for (let i = 0; i < features[spectrum].length; i++) {
        let lfreq = Math.log(i + 1)
        if (features[spectrum][i] > 0.001) {
            planets.add_fixed_mass(
                map(lfreq, 0, Math.log(features[spectrum].length - 1), p, 1024 - p),
                map(y, Math.log(1), Math.log(FFTSIZE / 2), 0, 1024),
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
    planets.add_planet(new Planet(512, 768, 8, 'black', 0, -0.5))
    createCanvas(1024, 1024) 
    background(color('rgb(255, 252, 245)'));
    frameRate(30);
}

function draw() {
    background(color('rgba(255, 252, 245, 0.1)'));
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
              "spectralCentroid",
              "perceptualSpread",
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