// connect to websocket and receive PCM data and play it

import PCMPlayer from "./pcm-player.js";
var ws = new WebSocket("ws://localhost:8080/ws");
ws.binaryType = "arraybuffer";

ws.onopen = function() {
    console.log("Connection opened");
}

var first = true;
var sampleRate, channels, bitsPerSample, bufferSize, player;
ws.onmessage = function(evt) {
    let data = new Int32Array(evt.data);
    if (first) {
        first = false;
        sampleRate = data[0];
        channels = data[1];
        bitsPerSample = data[2];
        console.log("Sample rate: " + sampleRate);
        console.log("Channels: " + channels);
        console.log("Bits per sample: " + bitsPerSample);
        player = new PCMPlayer({
            inputCodec: "Int" + bitsPerSample,
            channels: channels,
            sampleRate: sampleRate,
            flushingTime: 200
        });
        init_visualizer(player);
    } else {
        player.feed(evt.data);
        player.visualize();
    }
}

ws.onclose = function() {
    console.log("Connection closed");
    first = true;
    player.destroy();
}

ws.onerror = function(err) {
    console.log("Error: ", err);
}

function init_visualizer(player) {
    player.analyser = player.audioCtx.createAnalyser();
    player.gainNode.connect(player.analyser)
    player.analyser.connect(player.audioCtx.destination)
    player.canvasCtx = [];
    let canvas = document.getElementsByTagName("canvas");
    for (let i = 0; i < canvas.length; i++) {
        player.canvasCtx[i] = canvas[i].getContext("2d"); 
        player.WIDTH = canvas[i].width;
        player.HEIGHT = canvas[i].height;
    }
    player.analyser.fftSize = 256;
    player.bufferLengthAlt = player.analyser.frequencyBinCount;
    player.dataArrayAlt = new Uint8Array(player.bufferLengthAlt);
    player.barWidth = (player.WIDTH / player.bufferLengthAlt) * 2.5;
    player.visualize = function() {
        if (!this) return;
        this.drawVisual = requestAnimationFrame(this.visualize);
        this.analyser.getByteFrequencyData(this.dataArrayAlt);
        for (let i = 0; i < this.canvasCtx.length; i++) {
            this.canvasCtx[i].clearRect(0, 0, this.WIDTH, this.HEIGHT);
            this.canvasCtx[i].fillStyle = "rgb(0, 0, 0)";
            this.canvasCtx[i].fillRect(0, 0, this.WIDTH, this.HEIGHT);
            this.x = 0;
            for (let j = 0; j < this.bufferLengthAlt; j++) {
                this.barHeight = this.dataArrayAlt[j];
                this.canvasCtx[i].fillStyle = "rgb(" + (this.barHeight + 100) + ",50,50)";
                this.canvasCtx[i].fillRect(
                    this.x,
                    this.HEIGHT - this.barHeight / 2,
                    this.barWidth,
                    this.barHeight / 2
                );
                this.x += this.barWidth + 1;
            }
        }
    }
}
