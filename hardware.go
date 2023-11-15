package main

import (
    "github.com/d2r2/go-i2c"
    "log"
)

type hardware struct {
    pcm1864 *i2c.I2C
}

func (h *hardware) Init() {
    h.setupPCM1864()
}

func (h *hardware) setupPCM1864() {
    // Open i2c bus
    var err error
    h.pcm1864, err = i2c.NewI2C(0x4a, 1)
    if err != nil {
        log.Printf("i2c.NewI2C: %v", err)
    }
    h.pcm1864.WriteBytes([]byte{0x20, 0x11})
    h.pcm1864.WriteBytes([]byte{0x29, 0x00})
    h.pcm1864.WriteBytes([]byte{0x2A, 0x0F})
    h.pcm1864.WriteBytes([]byte{0x2B, 0x01})
    h.pcm1864.WriteBytes([]byte{0x2C, 0x00})
    h.pcm1864.WriteBytes([]byte{0x2D, 0x00})
}

func (h* hardware) changePCM1864Channel(channel byte) {
    //set register 0x06 and 0x07 to 0x4x where x is the channel number
    log.Printf("changePCM1864Channel: %b", 0x40 | channel - 48)
    if h.pcm1864 == nil {
        log.Printf("pcm1864 is nil")
        return
    }
    h.pcm1864.WriteBytes([]byte{0x06, 0x40 | (channel - 48)})
    h.pcm1864.WriteBytes([]byte{0x07, 0x40 | (channel - 48)})
}

func (h *hardware) Close() {
    if h.pcm1864 != nil {
        h.pcm1864.Close()
    }
}
