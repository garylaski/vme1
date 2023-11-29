package main

import (
    "github.com/d2r2/go-i2c"
    "github.com/stianeikeland/go-rpio/v4"
    "log"
)

type hardware struct {
    CS3	rpio.Pin
    CS4	rpio.Pin
    CS5	rpio.Pin
    CS6 rpio.Pin
    MUX2 rpio.Pin
    MUX3 rpio.Pin
    EQ1 rpio.Pin
    EQ2 rpio.Pin
}
const (
    CS3_PIN = 7 
    CS4_PIN = 8
    CS5_PIN = 25
    CS6_PIN = 26
    MUX2_PIN  = 22
    MUX3_PIN  = 27
    EQ1_PIN = 24
    EQ2_PIN = 23
)

func (h *hardware) Init() {
    h.setupPCM1864()
    h.setupMAX5419()
    h.setupPins()
    err := rpio.Open()
    if err != nil {
        log.Printf("rpio.Open: %v", err)
    }
    err = rpio.SpiBegin(rpio.Spi0)
    if err != nil {
        log.Printf("Spi0: %v", err)
    }
}

func (h *hardware) setupPins() {
    h.CS3 = rpio.Pin(CS3_PIN)
    h.CS4 = rpio.Pin(CS4_PIN)
    h.CS5 = rpio.Pin(CS5_PIN)
    h.CS6 = rpio.Pin(CS6_PIN)
    h.MUX2 = rpio.Pin(MUX2_PIN)
    h.MUX3 = rpio.Pin(MUX3_PIN)
    h.EQ1 = rpio.Pin(EQ1_PIN)
    h.EQ2 = rpio.Pin(EQ2_PIN)
    h.CS3.Output()
    h.CS4.Output()
    h.CS5.Output()
    h.CS6.Output()
    h.MUX2.Output()
    h.MUX3.Output()
    h.EQ1.Output()
    h.EQ2.Output()
}

func (h *hardware) setupPCM1864() {
    // Open i2c bus
    var err error
    pcm1864, err := i2c.NewI2C(0x4a, 1)
    if err != nil {
        log.Printf("i2c.NewI2C: %v", err)
    }
    commands := [][]byte{
        // Clock 0001 Master Mode 0001 Auto Clock Detector
        []byte{0x20, 0x11}, 
        /*
        // PLL Divider P = 1
        []byte{0x29, 0x00}, 
        // PLL Divider R = 16
        []byte{0x2A, 0x0F},
        // PLL Divider J = 1
        []byte{0x2B, 0x01},
        // PLL J.D = 0
        []byte{0x2C, 0x00},
        // PLL J.D Fraction = 0
        []byte{0x2D, 0x00},
        */
        // 0100 Reveive PCM Word Length = 16, LRCK is 50% 0011 Stereo PCM Word Length = 16, Format = TDM
        //[]byte{0x0B, 0xCF},
        // 0100 Reveive PCM Word Length = 32, LRCK is 50% 0011 Stereo PCM Word Length = 32, Format = TDM
        //[]byte{0x0B, 0x03},
        // TDM Transmision data 4ch TDM
        //[]byte{0x0C, 0x01},
        // ADC1L Input VIN1L
        []byte{0x06, 0x41},
        // ADC1R Input VIN1R
        []byte{0x07, 0x41},
        // ADC2L Input VIN2L
        []byte{0x08, 0x42},
        // ADC2R Input VIN2R
        []byte{0x09, 0x42},
        // Offset of 0x0f
        //[]byte{0x0D, 0x0F},
    }
    for _, command := range commands {
        _, err := pcm1864.WriteBytes(command)
        if err != nil {
            log.Println(err)
        }
    }
    pcm1864.Close()
}

func (h *hardware) setupMAX5419() {
    var i uint8
    for i = 0; i < 8; i++ {
        max5419, err := i2c.NewI2C(0x28 + i, 1)
        if err != nil {
            log.Printf("i2c.NewI2C: %v", err)
        }
        //halfway point
        max5419.WriteBytes([]byte{0x11, 0x80})
        max5419.Close()
    }
}

func (h* hardware) changePCM1864Channel(channel byte) {
    pcm1864, err := i2c.NewI2C(0x4a, 1)
    if err != nil {
        log.Printf("i2c.NewI2C: %v", err)
    }
    //set register 0x06 and 0x07 to 0x4x where x is the channel number
    log.Printf("changePCM1864Channel: %b", 0x40 | channel - 48)
    if pcm1864 == nil {
        log.Printf("pcm1864 is nil")
        return
    }
    pcm1864.WriteBytes([]byte{0x06, 0x40 | (channel - 48)})
    pcm1864.WriteBytes([]byte{0x07, 0x40 | (channel - 48)})
    pcm1864.Close()
}

func (h *hardware) Close() {
    log.Println("Hardware closed")
    rpio.SpiEnd(rpio.Spi0)
}

//https://ww1.microchip.com/downloads/aemDocuments/documents/OTH/ProductDocuments/DataSheets/11195c.pdf
// input is 0-255
func (h *hardware) writeMCP42100(channel byte, pot byte, data int) {
    h.setChannel(channel)
    // xx01 -> write
    // xx01 -> pot 0
    data = data & 0xff
    command := byte(0x10 | pot)
    h.CS3.Write(rpio.Low)
    rpio.SpiTransmit(command, byte(data))
    h.CS3.Write(rpio.High)
}

func (h* hardware) setChannel(channel byte) {
    // convert channel to binary
    // set CS pins to binary
    bit1 := channel & 1
    bit2 := channel & 2
    if bit1 == 1 {
        h.MUX2.High()
    } else {
        h.MUX2.Low()
    }
    if bit2 == 1 {
        h.MUX3.High()
    } else {
        h.MUX3.Low()
    }
}
//https://www.mouser.com/datasheet/2/609/MAX5417_AaaX5419-3129882.pdf
// Input 0 - 255
func (h *hardware) writeMAX5419(channel uint8, control byte, data int, cs int) {
    address := byte(0x50 | (channel << 1))
    if cs == 1 {
        address = address | 0x01
        channel = channel + 4
    }
    // convert data to a byte
    data = data & 0xFF
    max5419, err := i2c.NewI2C(0x28 + channel, 1)
    if err != nil {
        log.Printf("i2c.NewI2C: %v", err)
    }
    max5419.WriteBytes([]byte{0x11, byte(data)})
}

// https://ww1.microchip.com/downloads/aemDocuments/documents/OTH/ProductDocuments/DataSheets/22060b.pdf
// Input 0 - 1023
func (h *hardware) writeMCP4131(channel byte, data int) {
    h.setChannel(channel)
    // xx00 -> write
    command := byte(0x00)
    // convert data to 10 bits, 2 bytes
    data = data & 0x3FF
    data1 := byte(data >> 8)
    data2 := byte(data & 0xFF)
    h.CS4.Low()
    rpio.SpiTransmit(command | data1, data2)
    h.CS4.High()
}

// gain is 0 - 127
func (h *hardware) writeEQ(channel byte, band byte, center_frequency byte, gain byte, Q byte) {
    EQ := h.EQ1
    if (channel > 2) {
        EQ = h.EQ2
    }
    byte1 := (gain & 0x0F) | ( Q & 0x0F << 4)
    byte2 := (center_frequency & 0x0F) | (channel & 0x01 << 4)
    byte3 := (band & 0x07) | (0x07 << 3)
    byte4 := byte(0x04)
    EQ.High()
    rpio.SpiTransmit([]byte{byte1, byte2, byte3, byte4}...)
    EQ.Low()
}
