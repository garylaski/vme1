// connect to websocket and receive PCM data and play it
import PCMPlayer from "./pcm-player.js";
var ws = new WebSocket("ws://"+window.location.host+"/ws");
ws.binaryType = "arraybuffer";

var channelDisplay = [false, false, false, false];
var channelSolo = [false, false, false, false];
var channelMute = [false, false, false, false];

ws.onopen = function() {
    console.log("Connection opened");
    ws.send("init");
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
        bufferSize = data[3];
        console.log("Sample rate: " + sampleRate);
        console.log("Channels: " + channels);
        console.log("Bits per sample: " + bitsPerSample);
        console.log("Buffer size (bytes): " + bufferSize);
        
        player = new PCMPlayer({
            inputCodec: "Int" + bitsPerSample,
            channels: channels,
            sampleRate: sampleRate,
            flushTime: 20*1000*bufferSize / (sampleRate * channels * (bitsPerSample / 8)),
        });
        console.log("Flush time: " + player.option.flushTime + "ms");
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

const toggle = document.querySelectorAll('[aria-pressed]');
const panSliders = document.getElementsByClassName("pan");
var panValues = [];

for (let i = 0; i < panSliders.length; ++i) {
    panValues.push(panSliders[i].value);
}

const gainSliders = document.getElementsByClassName("gain");
var gainValues = [];

for (let i = 0; i < gainSliders.length; ++i) {
    gainValues.push(gainSliders[i].value);
}

const volumeSliders = document.getElementsByClassName("volume");
var volumeValues = [];

for (let i = 0; i < volumeSliders.length; ++i) {
    volumeValues.push(volumeSliders[i].value);
}

const displayButtons = document.getElementsByClassName("graphSelector");
const soloButtons = document.getElementsByClassName("solo");
const muteButtons = document.getElementsByClassName("mute");

// Add toggle effect to all buttons
for (let i = 0; i < toggle.length; ++i) {
    toggle[i].addEventListener('click', (e) => {  
       let pressed = e.target.getAttribute('aria-pressed') === 'true';
       e.target.setAttribute('aria-pressed', String(!pressed));
    });
}

for (let i = 0; i < displayButtons.length; ++i) {
    displayButtons.item(i).addEventListener("click", (e) => {
        if(e.target.getAttribute('aria-pressed'))
        {
            channelDisplay[i] = true;
        }
        else
        {
            channelDisplay[i] = false;
        }
    });
}

for (let i = 0; i < soloButtons.length; ++i) 
{
    soloButtons.item(i).addEventListener("click", (e) => {
        if(e.target.getAttribute('aria-pressed'))
        {
            channelSolo[i] = true;

            for (let j = 0; j < channelSolo.length; ++j)
            {
                if (channelSolo[j] && j != i)
                {
                    channelSolo[j] = false;
                    soloButtons.item(j).setAttribute('aria-pressed', false);
                }
            }

            for (let j = 0; j < volumeValues.length - 1; ++j)
            {
                if (j == i && !channelMute[i])
                {
                    ws.send("v" + j + " " + volumeValues[j]);
                }
                else
                {
                    ws.send("v" + j + " 0");
                }
            }
        }
        else
        {
            channelSolo[i] = false;

            for (let j = 0; j < volumeValues.length - 1; ++j)
            {
                ws.send("v" + j + " " + volumeValues[j]);
            }
        }
    });
}

for (let i = 0; i < muteButtons.length; ++i) 
{
    muteButtons.item(i).addEventListener("click", (e) => {
        if(e.target.getAttribute('aria-pressed'))
        {
            channelMute[i] = true;

            if (i == muteButtons.length - 1)
            {
                for (let j = 0; j < volumeValues.length - 1; ++j)
                {
                    ws.send("v" + j + " 0");
                }
            }
            else
            {
                ws.send("v" + i + " 0");
            }
        }
        else
        {
            channelMute[i] = false;

            if (i == muteButtons.length - 1)
            {
                for (let j = 0; j < volumeValues.length - 1; ++j)
                {
                    if (!channelMute[j])
                    {
                        ws.send("v" + j + " " + volumeValues[j]);
                    }
                }
            }
            else
            {
                ws.send("v" + i + " " + volumeValues[i]);
            }
        }
    });
}

for (let i = 0; i < panSliders.length; ++i) 
{
    panSliders.item(i).addEventListener("input", (e) => {
        panValues[i] = panSliders.item(i).value;

        ws.send("p" + i + " " + panValues[i]);
    });
}

for (let i = 0; i < gainSliders.length; ++i) 
{
    gainSliders.item(i).addEventListener("input", (e) => {
        gainValues[i] = gainSliders.item(i).value;

        var modValue = ((gainValues[i] - 72) * (gainValues[i] - 72)) / 75;
    
        if (gainValues[i] < 72)
        {
            modValue = 0 - modValue;
        }

        ws.send("g" + i + " " + modValue);
    });
}

for (let i = 0; i < volumeSliders.length; ++i) 
{
    volumeSliders.item(i).addEventListener("input", (e) => {
        volumeValues[i] = volumeSliders.item(i).value;

        if (channelMute[i])
        {
            channelMute[i] = false;
            muteButtons.item(i).setAttribute('aria-pressed', false);

            if (i == channelMute.length - 1)
            {
                if (!channelSolo.includes(true))
                {
                    for (let j = 0; j < volumeValues.length - 1; ++j)
                    {
                        ws.send("v" + j + " " + volumeValues[j]);
                    }
                }
                else
                {
                    for (let j = 0; j < volumeValues.length - 1; ++j)
                    {
                        if (channelSolo[j])
                        {
                            ws.send("v" + j + " " + volumeValues[j]);
                        }
                    }
                }
            }
        }

        if (i == channelMute.length - 1)
        {
            ws.send("v" + i + " " + volumeValues[i]);
        }
        else if (!channelMute[channelMute.length - 1] && (channelSolo[i] || !channelSolo.contains(true)))
        {
            ws.send("v" + i + " " + volumeValues[i]);
        }
    });
}

document.querySelector("#reset").addEventListener("click", (e) => {

    for (let i = 0; i < channelDisplay.length; ++i) 
    {
        channelDisplay[i] = false;
        displayButtons.item(i).setAttribute('aria-pressed', false);
    }

    for (let i = 0; i < channelSolo.length; ++i) 
    {
        channelSolo[i] = false;
        soloButtons.item(i).setAttribute('aria-pressed', false);
    }

    for (let i = 0; i < channelMute.length; ++i) 
    {
        channelMute[i] = false;
        muteButtons.item(i).setAttribute('aria-pressed', false);
    }

    for (let i = 0; i < panSliders.length; ++i) 
    {
        panSliders.item(i).value = 50;
        panValues[i] = 50;

        ws.send("p" + i + " " + panValues[i]);
    }

    for (let i = 0; i < gainSliders.length; ++i) 
    {
        gainSliders.item(i).value = 72;
        gainValues[i] = 72;

        ws.send("g" + i + " 0");
    }

    for (let i = 0; i < volumeSliders.length; ++i) 
    {
        volumeSliders.item(i).value = 50;
        volumeValues[i] = 50;

        ws.send("v" + i + " " + volumeValues[i]);
    }
});
document.querySelector("#save").addEventListener("click", (e) => {
    var data = {
        "channelDisplay": channelDisplay,
        "channelSolo": channelSolo,
        "channelMute": channelMute,
        "panValues": panValues,
        "gainValues": gainValues,
        "volumeValues": volumeValues
    }

    let jsonString = JSON.stringify(data);
    localStorage.setItem('savedLoadout', jsonString);
});
document.querySelector("#load").addEventListener("click", (e) => {
    const jsonString = localStorage.getItem('savedLoadout') || '';

    if (jsonString != '')
    {
        console
        const obj = JSON.parse(jsonString);

        channelDisplay = obj.channelDisplay;
        channelSolo = obj.channelSolo;
        channelMute = obj.channelMute;
        panValues = obj.panValues;
        gainValues = obj.gainValues;
        volumeValues = obj.volumeValues;

        for (let i = 0; i < volumeValues.length; ++i)
        {
            volumeSliders.item(i).value = volumeValues[i];
            ws.send("v" + i + " " + volumeValues[i]);
        }

        for (let i = 0; i < gainValues.length; ++i)
        {
            gainSliders.item(i).value = gainValues[i];
            ws.send("g" + i + " " + gainValues[i]);
        }

        for (let i = 0; i < panValues.length; ++i)
        {
            panSliders.item(i).value = panValues[i];
            ws.send("p" + i + " " + panValues[i]);
        }

        for (let i = 0; i < channelSolo.length; ++i)
        {
            soloButtons.item(i).setAttribute('aria-pressed', channelSolo[i]);

            if (channelSolo[i])
            {
                for (let j = 0; j < volumeValues.length - 1; ++j)
                {
                    if (j == i)
                    {
                        ws.send("v" + j + " " + volumeValues[j]);
                    }
                    else
                    {
                        ws.send("v" + j + " 0");
                    }
                }
            }
        }

        for (let i = 0; i < channelMute.length; ++i)
        {
            muteButtons.item(i).setAttribute('aria-pressed', channelMute[i]);

            if (channelMute[i])
            {
                if (i == channelMute.length - 1)
                {
                    for (let j = 0; j < volumeValues.length - 1; ++j)
                    {
                        ws.send("v" + j + " 0");
                    }
                }
                else
                {
                    ws.send("v" + i + " 0");
                }
            }
        }
    }
});