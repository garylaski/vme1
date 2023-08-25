package main

import (
    "github.com/go-audio/wav"
    "github.com/go-audio/audio"
    "os"
    "log"
)

type wavSource struct {
    Decoder *wav.Decoder
    File    *os.File
}

func (w *wavSource) Init() (int, int, int) {
    file, err := os.Open("./test.wav")
    if err != nil {
        log.Fatal(err)
    }
    w.File = file
    // Create a decoder
    w.Decoder = wav.NewDecoder(w.File)
    if !w.Decoder.IsValidFile() {
        log.Fatal(err)
    }
    // Get the sample rate, number of channels and bit depth
    sampleRate := w.Decoder.SampleRate
    numChans := w.Decoder.NumChans
    bitDepth := w.Decoder.BitDepth
    return int(sampleRate), int(numChans), int(bitDepth)
}

func (w *wavSource) Read() ([]byte, error) {
    // Read audio frames from the decoder
    buffer := &audio.IntBuffer{Data: make([]int, byteBufferSize)}
    if _, err := w.Decoder.PCMBuffer(buffer); err != nil {
        return nil, err
    }

    return pcmIntToBytes(buffer.Data, w.Decoder.BitDepth), nil
}
