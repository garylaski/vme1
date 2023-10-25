// connect to websocket and receive PCM data and play it

import PCMPlayer from "./pcm-player.js";
var ws = new WebSocket("ws://"+window.location.host+"/ws");
ws.binaryType = "arraybuffer";

ws.onopen = function() {
    console.log("Connection opened");
}

var first = true;
var second = false;
var sampleRate, channels, bitsPerSample, bufferSize, player, second;
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
            flushingTime: 600
        });
        init_visualizer(player);
	second = true;
    } else {
        player.feed(evt.data);
	if (second && player != undefined) {
	    requestAnimationFrame(player.visualize);
	    second = false;
	}
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
    player.visualize = function(ms) {
        for (let i = 0; i < player.canvasCtx.length; i++) {
            player.promises.push(new Promise((resolve, reject) => {
                player.analysers[i].getByteFrequencyData(player.dataArrays[i]);
                if (player.parent[i].display == "none") {
                    resolve();
                    return;
                }
                player.canvas[i].width = player.parent[i].offsetWidth;
                player.canvas[i].height = player.parent[i].offsetHeight;
                player.barWidth = (player.canvas[i].width / player.bufferLengthAlt) * 2.5;
                player.canvasCtx[i].clearRect(0, 0, player.canvas[i].width, player.canvas[i].height);
                player.canvasCtx[i].fillStyle = "rgb(0, 0, 0)";
                player.canvasCtx[i].fillRect(0, 0, player.canvas[i].width, player.canvas[i].height);
                let x = 0;
                player.canvasCtx[i].fillStyle = "rgb(255,50,50)";
                for (let j = 0; j < player.bufferLengthAlt; j++) {
                    player.canvasCtx[i].fillRect(
                        x,
                        player.canvas[i].height - player.dataArrays[i][j],
                        player.barWidth,
                        player.dataArrays[i][j]
                    );
                    x += player.barWidth + 1;
                }
                resolve();
            }));
        }
        Promise.all(player.promises).then(() => {
            player.promises = [];
            requestAnimationFrame(player.visualize);
        });
    }
}
