// connect to websocket and receive PCM data and play it
import PCMPlayer from "./pcm-player.js";
var ws = new WebSocket("ws://"+window.location.host+"/ws");
ws.binaryType = "arraybuffer";

var channelDisplay = [true, true, true, true];
var channelSolo = [false, false, false, false];
var channelMute = [false, false, false, false];
let activeEQ = 0;

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
            flushTime: 1000*bufferSize / (sampleRate * channels * (bitsPerSample / 8)),
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

function frequencyToX(frequency) {
    //logarithmic scale
    let min = 20;
    let max = 20000;
    let x = (Math.log(frequency) - Math.log(min)) / (Math.log(max) - Math.log(min));
    return x *player.parent.offsetWidth;
}
function xToFrequency(x) {
    let min = 20;
    let max = 20000;
    let frequency = Math.exp((x / player.parent.offsetWidth) * (Math.log(max) - Math.log(min)) + Math.log(min));
    return frequency;
}
function gainToY(gain) {
    let min = -12;
    let max = 12;
    let y = (gain - min) / (max - min);
    return (1 - y) * player.parent.offsetHeight;
}
function yToGain(y) {
    let min = -12;
    let max = 12;
    let gain = (1 - (y / player.parent.offsetHeight)) * (max - min) + min;
    return gain;
}
function textWidth(text) {
    player.canvasCtx.font = "12px Arial";
    return player.canvasCtx.measureText(text).width;
}

const channelColors = ["rgb(255,0,0)", "rgb(0,255,0)", "rgb(0,0,255)", "rgb(255,255,0)"];
const channelColorsDark = ["rgb(127,0,0)", "rgb(0,127,0)", "rgb(0,0,127)", "rgb(127,127,0)"];
const channelColorsLight = ["rgb(255,127,127)", "rgb(127,255,127)", "rgb(127,127,255)", "rgb(255,255,127)"];
const low_bands = [31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315];
const low_mid_bands = [160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600];
const high_mid_bands = [630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300];
const high_bands = [1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500, 16000];
const bands = [low_bands, low_mid_bands, high_mid_bands, high_bands];
const gain = [-12, -10, -8, -6, -4, -2, 0, 2, 4, 6, 8, 10, 12]
const q = [0.404, 0.667, 1.41, 2.15, 2.87, 4.32, 5.76, 8.65];
function snapToGrid(x, y, band) {
    let closestX = bands[band].reduce((prev, curr) => Math.abs(curr - x) < Math.abs(prev - x) ? curr : prev);
    let closestY = gain.reduce((prev, curr) => Math.abs(curr - y) < Math.abs(prev - y) ? curr : prev);
    return [closestX, closestY];
}

function sendEQ(band) {
    ws.send("e" + activeEQ + " " + band + " " + bands[band].indexOf(player.eqFreqs[activeEQ][band]) + " " + player.eqQindex[activeEQ][band] + " " + gain.indexOf(player.eqGains[activeEQ][band]));
    console.log("e" + activeEQ + " " + band + " " + bands[band].indexOf(player.eqFreqs[activeEQ][band]) + " " + player.eqQindex[activeEQ][band] + " " + gain.indexOf(player.eqGains[activeEQ][band]));
}

function init_visualizer(player) {
    player.splitter = player.audioCtx.createChannelSplitter(2);
    player.gainNode.connect(player.splitter);
    player.analysers = [];
    player.dataArrays = [];
    player.promises = [];
    player.eqFreqs = [];
    player.eqGains = [];
    player.eqQindex = [];
    for (let i = 0; i < channels; i++) {
        player.analysers[i] = player.audioCtx.createAnalyser();
        player.analysers[i].fftSize = 2048;
        player.splitter.connect(player.analysers[i], i);
        player.dataArrays[i] = new Uint8Array(player.analysers[i].frequencyBinCount);
        player.bufferLengthAlt = player.analysers[i].frequencyBinCount;
        player.eqFreqs[i] = [low_bands[5], low_mid_bands[5], high_mid_bands[5], high_bands[5]];
        player.eqGains[i] = [0, 0, 0, 0];
        player.eqQindex[i] = [0, 0, 0, 0];
    }
    player.canvasCtx = [];
    player.canvas = document.querySelector("canvas");
    player.parent = document.querySelector(".visualizer");
    player.canvasCtx = player.canvas.getContext("2d"); 
    player.canvasCtx.imageSmoothingEnabled = false
    player.canvas.addEventListener("mousemove", function(e) {
        if (player.highlighted != -1 && e.buttons == 1) {
            let prevFreq = player.eqFreqs[activeEQ][player.highlighted];
            let prevGain = player.eqGains[activeEQ][player.highlighted];
            let x = e.clientX - player.canvas.offsetLeft;
            let y = e.clientY - player.canvas.offsetTop;
            player.eqFreqs[activeEQ][player.highlighted] = snapToGrid(xToFrequency(x), yToGain(y), player.highlighted)[0];
            player.eqGains[activeEQ][player.highlighted] = snapToGrid(xToFrequency(x), yToGain(y), player.highlighted)[1];
            if (player.eqFreqs[activeEQ][player.highlighted] != prevFreq || player.eqGains[activeEQ][player.highlighted] != prevGain) {
                sendEQ(player.highlighted);
            }
            return;
        }
        let x = e.clientX - player.canvas.offsetLeft;
        let y = e.clientY - player.canvas.offsetTop;
        player.highlighted = -1;
        for (let i = 0; i < 4; i++) {
            let radius = q[player.eqQindex[activeEQ][i]] * 20;
            if (Math.sqrt(Math.pow(x - player.eqPosX[i], 2) + Math.pow(y - player.eqPosY[i], 2)) < radius) {
                player.highlighted = i;
                break;
            }
        }
        if (player.highlighted != -1) {
            player.canvas.style.cursor = "grab";
        } else {
            player.canvas.style.cursor = "default";
        }
    });

    player.canvas.addEventListener("wheel", function(e) {
        if (player.highlighted != -1) {
            let prevQ = player.eqQindex[activeEQ][player.highlighted];
            //increase width of selected eq circle
            if (e.deltaY < 0 && player.eqQindex[activeEQ][player.highlighted] < q.length - 1) {
                player.eqQindex[activeEQ][player.highlighted] += 1;
            } else if (player.eqQindex[activeEQ][player.highlighted] > 0) {
                player.eqQindex[activeEQ][player.highlighted] -= 1;
            }
            if (player.eqQindex[activeEQ][player.highlighted] != prevQ) {
                sendEQ(player.highlighted);
            }
        }
    });
    let eqColor = "rgb(255, 255, 255)";
    let eqHighlightColor = "rgb(255, 0, 0)";
    player.highlighted = -1;
    player.canvasCtx.fillStyle = eqColor;
    player.visualize = function() {
        player.canvas.width = player.parent.offsetWidth;
        player.canvas.height = player.parent.offsetHeight;
        player.barWidth = player.canvas.width / player.bufferLengthAlt;
        player.canvasCtx.clearRect(0, 0, player.canvas.width, player.canvas.height);
        player.canvasCtx.fillStyle = "rgb(0, 0, 0)";
        player.canvasCtx.fillRect(0, 0, player.canvas.width, player.canvas.height);
        let gridColor = "rgb(205, 205, 205)";
        player.canvasCtx.font = "12px Monospace";
        let freq_values = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 15000, 20000];
        for (let i = 0; i < freq_values.length; i++) {
            let x = frequencyToX(freq_values[i]);
            player.canvasCtx.fillStyle = gridColor;
            player.canvasCtx.fillText(freq_values[i], x - textWidth(freq_values[i], "12px Monospace") - 5, 10);
            player.canvasCtx.fillRect(x - 1, 0, 1, player.canvas.height);
        }
        player.canvasCtx.fillStyle = gridColor;
        // draw 4 band EQ draggable circles
        // make the EQ draggable
        if (activeEQ != -1) {
            player.eqPosX = [frequencyToX(player.eqFreqs[activeEQ][0]), frequencyToX(player.eqFreqs[activeEQ][1]), frequencyToX(player.eqFreqs[activeEQ][2]), frequencyToX(player.eqFreqs[activeEQ][3])];
            player.eqPosY = [gainToY(player.eqGains[activeEQ][0]), gainToY(player.eqGains[activeEQ][1]), gainToY(player.eqGains[activeEQ][2]), gainToY(player.eqGains[activeEQ][3])];
            player.eqSize = [(player.eqQindex[activeEQ][0] + 5) * 2, (player.eqQindex[activeEQ][1] + 5) * 2, (player.eqQindex[activeEQ][2] + 5) * 2, (player.eqQindex[activeEQ][3] + 5) * 2];
            for (let i = 0; i < 4; i++) {
                player.canvasCtx.beginPath();
                if (player.highlighted == i) {
                    let x = player.eqPosX[i];
                    let y = player.eqPosY[i];
                    player.canvasCtx.fillStyle = "rgb(255, 255, 255)";
                    player.canvasCtx.font = "12px monospace";
                    player.canvasCtx.fillText("F: " + Math.round(xToFrequency(x)) + "Hz", x - textWidth("F: " + Math.round(xToFrequency(x)) + "Hz", "12px monospace") / 2, y - player.eqSize[i] - 10);
                    player.canvasCtx.fillText("G: " + Math.round(yToGain(y)) + "db", x - textWidth("G: " + Math.round(yToGain(y)) + "db", "12px monospace") / 2, y + player.eqSize[i] + 10);
                    player.canvasCtx.fillText("Q: " + q[player.eqQindex[activeEQ][i]] + "db", x - textWidth("Q: " + q[player.eqQindex[activeEQ][i]]+ "db", "12px monospace") / 2, y + player.eqSize[i] + 25);
                    player.canvasCtx.fillStyle = channelColors[activeEQ];
                } else {
                    player.canvasCtx.fillStyle = channelColorsLight[activeEQ];
                }
                player.canvasCtx.arc(player.eqPosX[i], player.eqPosY[i], player.eqSize[i], 0, 2 * Math.PI);
                player.canvasCtx.fill();
            }
        }


        for (let i = 0; i < channels; i++) {
            if (!channelDisplay[i]) {
                continue;
            }
            player.promises.push(new Promise((resolve, reject) => {
                player.canvasCtx.beginPath();
                player.canvasCtx.moveTo(0, player.canvas.height);
                player.analysers[i].getByteFrequencyData(player.dataArrays[i]);
                const data = interpolate(logScale(player.dataArrays[i]));
                //const data = logScale(player.dataArrays[i]);
                let x = 0;
                player.canvasCtx.strokeStyle = channelColors[i];
                for (let j = 0; j < player.bufferLengthAlt; j++) {
                    player.canvasCtx.lineTo(x, player.canvas.height - data[j] + 1);
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
const eqButtons = document.getElementsByClassName("equal");



// Add toggle effect to all buttons
for (let i = 0; i < toggle.length; ++i) {
    toggle[i].addEventListener('click', (e) => {  
        let pressed = e.target.getAttribute('aria-pressed') === 'true';
        e.target.setAttribute('aria-pressed', String(!pressed));
    });
}

for (let i = 0; i < displayButtons.length; ++i) {
    displayButtons.item(i).addEventListener("click", (e) => {
        if(e.target.getAttribute('aria-pressed') === 'true')
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
        if(e.target.getAttribute('aria-pressed') === 'true')
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
        console.log(channelSolo);
    });
}

for (let i = 0; i < muteButtons.length; ++i) 
{
    muteButtons.item(i).addEventListener("click", (e) => {
        if(e.target.getAttribute('aria-pressed') === 'true')
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

for (let i = 0; i < eqButtons.length; ++i)
{
    eqButtons.item(i).addEventListener("click", (e) => {
        if (i >= channels) { e.target.setAttribute('aria-pressed', false); return; }
        if(e.target.getAttribute('aria-pressed') === 'true')
        {
            activeEQ = i;
            for (let j = 0; j < eqButtons.length; ++j)
            {
                if (j != i)
                {
                    eqButtons.item(j).setAttribute('aria-pressed', false);
                }
            }
        }
        else
        {
            activeEQ = -1;
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
        else if (!channelMute[channelMute.length - 1] && (channelSolo[i] || !channelSolo.includes(true)))
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
/*
    band = [low, low_mid, high_mid, high]
channel = [l, r]

    */
