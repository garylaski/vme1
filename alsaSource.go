package main

import (
    "github.com/yobert/alsa"
    "log"
)

type alsaSource struct {
    device *alsa.Device
}
const (
    sampleRate = 16000
    numChans = 2
    bitDepth = 32
)
func (a *alsaSource) Init() (int, int, int) {
    cards, err := alsa.OpenCards()
	if err != nil {
		log.Fatal(err)
	}
	for _, card := range cards {
		devices, err := card.Devices()
		if err != nil {
            log.Fatal(err)
		}
		for _, device := range devices {
			if device.Type != alsa.PCM {
				continue
			}
			if device.Record && a.device == nil {
				a.device = device
			}
		}
	}
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
    if _, err := a.device.NegotiateBufferSize(1024); err != nil {
        log.Fatal(err)
    }
    if err := a.device.Prepare(); err != nil {
        log.Fatal(err)
    }

    return sampleRate, numChans, bitDepth
}

func (a *alsaSource) Read() ([]byte, error) {
    buffer := make([]byte, 1024)
    if err := a.device.Read(buffer); err != nil {
        log.Fatal(err)
    }

    return buffer, nil
}

func (a *alsaSource) Close() {
    a.device.Close()
}

