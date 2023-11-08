// connect to websocket and receive PCM data and play it

import PCMPlayer from "./pcm-player.js";
var ws = new WebSocket("ws://"+window.location.host+"/ws");
ws.binaryType = "arraybuffer";

showGraph(1);
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
    player.splitter = player.audioCtx.createChannelSplitter(2);
    player.gainNode.connect(player.splitter);
    player.analysers = [];
    player.dataArrays = [];
    player.promises = [];
    for (let i = 0; i < 2; i++) {
        player.analysers[i] = player.audioCtx.createAnalyser();
        player.analysers[i].fftSize = 2048;
        player.splitter.connect(player.analysers[i], i);
        player.dataArrays[i] = new Uint8Array(player.analysers[i].frequencyBinCount);
        player.bufferLengthAlt = player.analysers[i].frequencyBinCount;
    }
    player.canvasCtx = [];
    player.canvas = document.querySelector("canvas");
    player.parent = document.querySelector(".visualizer");
    player.canvasCtx = player.canvas.getContext("2d"); 
    player.canvasCtx.imageSmoothingEnabled = false
    player.visualize = function(ms) {
        player.canvas.width = player.parent.offsetWidth;
        player.canvas.height = player.parent.offsetHeight;
        player.barWidth = player.canvas.width / player.bufferLengthAlt;
        player.canvasCtx.clearRect(0, 0, player.canvas.width, player.canvas.height);
        player.canvasCtx.fillStyle = "rgb(0, 0, 0)";
        player.canvasCtx.fillRect(0, 0, player.canvas.width, player.canvas.height);
        // draw the frequency grid background
        let gridColor = "rgb(205, 205, 205)";
        let numHz = 10;
        player.canvasCtx.font = "12px Monospace";
        // draw the frequency grid for each hz
        let freq = sampleRate;
        let x = player.canvas.width;
        player.canvasCtx.fillStyle = gridColor;
        for (let i = numHz; i > 0; i--) {
            freq /= 2;
            player.canvasCtx.fillRect(x, 0, 1, player.canvas.height);
            // draw the hz text
            player.canvasCtx.fillText(Math.floor(freq) + "Hz", x + 2, 12);
            x -= player.canvas.width / numHz;
        }
        for (let i = 0; i < 2; i++) {
            player.promises.push(new Promise((resolve, reject) => {
                player.canvasCtx.beginPath();
                player.canvasCtx.moveTo(0, player.canvas.height);
                player.analysers[i].getByteFrequencyData(player.dataArrays[i]);
                const data = interpolate(logScale(player.dataArrays[i]));
                let x = 0;
                if (i == 0) {
                    player.canvasCtx.strokeStyle = "rgb(255,0,0)";
                } else {
                    player.canvasCtx.strokeStyle = "rgb(0,255,0)";
                }
                for (let j = 0; j < player.bufferLengthAlt; j++) {
                    player.canvasCtx.lineTo(x, player.canvas.height - data[j]);
                    x += player.barWidth;
                }
                player.canvasCtx.stroke();
                resolve();
            }));
        }
        Promise.all(player.promises).then(() => {
            player.promises = [];
            requestAnimationFrame(player.visualize);
        });
    }
}

function logScale(data) {
  let temp = []
  let length = data.length
  let maxLog = Math.log(length)
  let step = maxLog / length
  
  for (let i = 0; i < length; i++) {
    let dataIndex = Math.floor(Math.exp(step * i))
    temp.push(data[dataIndex])
  }
  
  return temp
}
function easeInOutSine(x) {
        return -(Math.cos(Math.PI * x) - 1) / 2
}

function interpolate(data, easing = easeInOutSine) {
  // since the low-end data is more step-ish, we would just need to process this part, like 3/4 of the data
  let halfwayPoint = Math.floor(data.length / 4)
  let firstHalf = data.slice(0, halfwayPoint * 3)
  let secondHalf = data.slice(halfwayPoint * 3)

  let output = []
  let group = [firstHalf[0]]

  for (let i = 1; i < firstHalf.length; i++) {
    if (firstHalf[i] !== group[0]) {
      // if all elements in the group equal 0, add them to the output array
      if (group[0] === 0) {
        output.push(...group)
      } else {
        // calculate the step according the count of same-number elements
        let step = 1 / group.length
        let difference = firstHalf[i] - group[0]

        // copulate the output array
        for (let j = 0; j < group.length; j++) {
          // Apply the easing function to the interpolated value
          let value = group[0] + difference * easing(step * j)
          output.push(value)
        }
      }

      group = [firstHalf[i]] // Reset the group
    } else {
      group.push(firstHalf[i])
    }
  }

  // process the final group
  for (let j = 0; j < group.length; j++) {
    let value = group[0]
    output.push(value)
  }

  // combine the processed first half and the original second half
  return [...output, ...secondHalf]
}
