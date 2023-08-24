// connect to websocket and receive PCM data and play it

import PCMPlayer from "./pcm-player.js";
var player;
var ws = new WebSocket("ws://localhost:8080/ws");
ws.binaryType = "arraybuffer";

ws.onopen = function() {
    console.log("Connection opened");
}

var first = true;
var sampleRate, channels, bitsPerSample, bufferSize;
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
    } else {
        player.feed(evt.data);
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

