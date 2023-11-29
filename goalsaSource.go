package main

import (
    "log"
    goalsa "github.com/cocoonlife/goalsa"
    "encoding/binary"
)

type goalsaSource struct {
    device *goalsa.CaptureDevice
}

const (
    bytesPerSample = 4
)
func (a *goalsaSource) Init() (int, int, int) {
    var err error
    bufferParams := goalsa.BufferParams{
        BufferFrames: byteBufferSize / bytesPerSample,
        PeriodFrames: byteBufferSize / (bytesPerSample * 2),
    }
    a.device, err = goalsa.NewCaptureDevice("hw:1,1", numChans, goalsa.FormatS32LE, sampleRate, bufferParams)
    if err != nil {
        log.Fatal(err)
    }
    err = a.device.StartReadThread()
    if err != nil {
        log.Fatal(err)
    }
    if a.device.BufferParams.BufferFrames != bufferParams.BufferFrames {
        log.Fatalf("BufferParams.BufferFrames: %v != %v", a.device.BufferParams.BufferFrames, bufferParams.BufferFrames)
    }
    if a.device.BufferParams.PeriodFrames != bufferParams.PeriodFrames {
        log.Fatalf("BufferParams.PeriodFrames: %v != %v", a.device.BufferParams.PeriodFrames, bufferParams.PeriodFrames)
    }
    // Fake 4 channels
    //return sampleRate, 4, 16
    return sampleRate, 2, 32
}

func (a *goalsaSource) Read(buffer *[]byte) (error) {
    intbuffer := make([]int32, byteBufferSize / bytesPerSample)
    samples, err := a.device.Read(intbuffer)
    if err != nil {
        return err
    }
    for i := 0; i < samples; i++ {
        index := i * bytesPerSample
        binary.LittleEndian.PutUint32((*buffer)[index:index+bytesPerSample], uint32(intbuffer[i]))
    }
    return nil
}

func (a *goalsaSource) Close() {
    a.device.Close()
}

