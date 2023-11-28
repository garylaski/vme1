package main

import (
    "github.com/go-audio/wav"
    "github.com/go-audio/audio"
    "os"
    "log"
    "time"
)

type wavSource struct {
    Decoder *wav.Decoder
    File    *os.File
    previousTime time.Time
    dt time.Duration
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
    w.dt = time.Second * time.Duration(byteBufferSize / bitDepth) / (time.Duration(sampleRate))
    w.previousTime = time.Now()
    return int(sampleRate), int(numChans), int(bitDepth)
}

func (w *wavSource) Read(buffer2 *[]byte) (error) {
    // Read audio frames from the decoder
    if time.Since(w.previousTime) < w.dt {
        *buffer2 = nil
        return nil
    }
    w.previousTime = time.Now()
    buffer := &audio.IntBuffer{Data: make([]int, byteBufferSize)}
    if _, err := w.Decoder.PCMBuffer(buffer); err != nil {
        return err
    }  
    *buffer2 = pcmIntToBytes(buffer.Data, w.Decoder.BitDepth)
    return nil
}

func (w *wavSource) Close() {
    w.File.Close()
}
