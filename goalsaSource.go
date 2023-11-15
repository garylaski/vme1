package main

import (
    "log"
    goalsa "github.com/cocoonlife/goalsa"
)

type goalsaSource struct {
    device *goalsa.CaptureDevice
}
func (a *goalsaSource) Init() (int, int, int) {
    var err error
    bytesPerSample := 4
    bufferParams := goalsa.BufferParams{
        BufferFrames: byteBufferSize / bytesPerSample,
        PeriodFrames: byteBufferSize / (bytesPerSample * 2),
    }
    a.device, err = goalsa.NewCaptureDevice("hw:1,1", numChans, goalsa.FormatS32LE, 16000, bufferParams)
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
    return 16000, 2, 32
}

func (a *goalsaSource) Read(buffer *[]byte) (error) {
    int32buffer := make([]int32, byteBufferSize / 4)
    samples, err := a.device.Read(int32buffer)
    if err != nil {
        return err
    }
    // c style cast from int32 to byte
    for i := 0; i < samples; i++ {
        (*buffer)[i*4] = byte(int32buffer[i])
        (*buffer)[i*4+1] = byte(int32buffer[i] >> 8)
        (*buffer)[i*4+2] = byte(int32buffer[i] >> 16)
        (*buffer)[i*4+3] = byte(int32buffer[i] >> 24)
    }
    return nil
}

func (a *goalsaSource) Close() {
    a.device.Close()
}

