// connect to websocket and receive PCM data and play it

import PCMPlayer from "./pcm-player.js";
var ws = new WebSocket("ws://"+window.location.host+"/ws");
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
            flushingTime: 400
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
    player.splitter = player.audioCtx.createChannelSplitter(4);
    player.gainNode.connect(player.splitter);
    player.analysers = [];
    player.dataArrays = [];
    player.promises = [];
    for (let i = 0; i < 4; i++) {
        player.analysers[i] = player.audioCtx.createAnalyser();
        player.analysers[i].fftSize = 256;
        player.splitter.connect(player.analysers[i], i);
        player.dataArrays[i] = new Uint8Array(player.analysers[i].frequencyBinCount);
        player.bufferLengthAlt = player.analysers[i].frequencyBinCount;
    }
    player.canvasCtx = [];
    player.canvas = document.getElementsByTagName("canvas");
    player.parent = document.getElementsByClassName("visualizer");
    for (let i = 0; i < player.canvas.length; i++) {
        player.canvasCtx[i] = player.canvas[i].getContext("2d"); 
        player.canvasCtx[i].imageSmoothingEnabled = false
    }
    player.visualize = function() {
        if (!this) return;
        this.drawVisual = requestAnimationFrame(this.visualize);
        for (let i = 0; i < this.canvasCtx.length; i++) {
            this.promises.push(new Promise((resolve, reject) => {
                this.analysers[i].getByteFrequencyData(this.dataArrays[i]);
                if (this.parent[i].display == "none") {
                    resolve();
                    return;
                }
                this.canvas[i].width = this.parent[i].offsetWidth;
                this.canvas[i].height = this.parent[i].offsetHeight;
                this.barWidth = (this.canvas[i].width / this.bufferLengthAlt) * 2.5;
                this.canvasCtx[i].clearRect(0, 0, this.canvas[i].width, this.canvas[i].height);
                this.canvasCtx[i].fillStyle = "rgb(0, 0, 0)";
                this.canvasCtx[i].fillRect(0, 0, this.canvas[i].width, this.canvas[i].height);
                let x = 0;
                this.canvasCtx[i].fillStyle = "rgb(255,50,50)";
                for (let j = 0; j < this.bufferLengthAlt; j++) {
                    this.canvasCtx[i].fillRect(
                        x,
                        this.canvas[i].height - this.dataArrays[i][j],
                        this.barWidth,
                        this.dataArrays[i][j]
                    );
                    x += this.barWidth + 1;
                }
                resolve();
            }));
        }
        Promise.all(this.promises).then(() => {
            this.promises = [];
        });
    }
}
