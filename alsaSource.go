package main

import (
    "github.com/yobert/alsa"
    "log"
)

type alsaSource struct {
    device *alsa.Device
}
const (
    sampleRate = 96000
    numChans = 2
    bitDepth = 32
)
func (a *alsaSource) Init() (int, int, int) {
    cards, err := alsa.OpenCards()
    if err != nil {
        log.Fatal(err)
    }
    card := cards[1]
    devices, err := card.Devices()
    if err != nil {
        log.Fatal(err)
    }
    devices, err = card.Devices()
    if err != nil {
        log.Fatal(err)
    }
    a.device = devices[1]
	if a.device == nil {
		log.Fatal("No recording device found")
	}
    if err := a.device.Open(); err != nil {
        log.Fatal(err)
    }
    if _, err := a.device.NegotiateRate(sampleRate); err != nil {
        log.Fatal(err)
    }
    if _, err := a.device.NegotiateChannels(numChans); err != nil {
        log.Fatal(err)
    }
    if _, err := a.device.NegotiateFormat(alsa.S32_LE); err != nil {
        log.Fatal(err)
    }
    if v, err := a.device.NegotiateBufferSize(byteBufferSize / 2); err != nil {
        log.Fatal(err)
    } else {
        log.Printf("Negotiated buffer size: %v", v)
    }
    if err := a.device.Prepare(); err != nil {
        log.Fatal(err)
    }

    return sampleRate, numChans, bitDepth
}

func (a *alsaSource) Read(buffer *[]byte) (error) {
    err := a.device.Read(*buffer)
    return err
}

func (a *alsaSource) Close() {
    a.device.Close()
}

