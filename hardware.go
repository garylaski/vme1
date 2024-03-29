package main

import (
    "github.com/d2r2/go-i2c"
    "github.com/stianeikeland/go-rpio/v4"
    "log"
    "os/exec"
    "time"
)

type hardware struct {
    CS3	rpio.Pin
    CS4	rpio.Pin
    CS5	rpio.Pin
    CS6_1 rpio.Pin
    CS6_2 rpio.Pin
    CS6_3 rpio.Pin
    CS6_4 rpio.Pin
    MUX2 rpio.Pin
    MUX3 rpio.Pin
    EQ1 rpio.Pin
    EQ2 rpio.Pin
}
var (
    CS3_PIN int = 1
    CS4_PIN int = 8
    CS5_PIN int = 25
    CS6_1_PIN int = 26
    CS6_2_PIN int = 0
    CS6_3_PIN int = 5
    CS6_4_PIN int = 6
    MUX2_PIN int = 22
    MUX3_PIN int = 27
    EQ1_PIN int = 24
    EQ2_PIN int = 23
) 

func (h *hardware) Init() {
    h.setupPCM1864()
    h.setupMAX5419()
    err := rpio.Open()
    if err != nil {
        log.Printf("rpio.Open: %v", err)
    }
    h.setupPins()
    rpio.SpiMode(0, 0)
    rpio.SpiChipSelect(2)
    rpio.SpiSpeed(2000)
    err = rpio.SpiBegin(rpio.Spi0)
    if err != nil {
        log.Printf("Spi0: %v", err)
    }
    rpio.SpiMode(0, 0)
    rpio.SpiChipSelect(2)
    rpio.SpiSpeed(2000)
    var i byte
    for i = 0; i < 4; i++ {
        //Pan 
        //Pregain
        h.writeMCP4131(i, h.CS5, 127)
        //Threshold
        h.writeMCP4131(i, h.CS4, 255)
        //Ratio
        h.writeMCP42100(i, 0, 0)
        //Outgain?
        h.writeMCP42100(i, 1, 0)
	gain := byte(12)
        h.writeEQ(i, 0, 5, gain, 6)
        h.writeEQ(i, 1, 5, gain, 6)
        h.writeEQ(i, 2, 5, gain, 6)
        h.writeEQ(i, 3, 5, gain, 6)
    }
}

func (h *hardware) setupPins() {
    h.CS3 = rpio.Pin(CS3_PIN)
    h.CS4 = rpio.Pin(CS4_PIN)
    h.CS5 = rpio.Pin(CS5_PIN)
    h.CS6_1 = rpio.Pin(CS6_1_PIN)
    h.CS6_2 = rpio.Pin(CS6_2_PIN)
    h.CS6_3 = rpio.Pin(CS6_3_PIN)
    h.CS6_4 = rpio.Pin(CS6_4_PIN)
    h.MUX2 = rpio.Pin(MUX2_PIN)
    h.MUX3 = rpio.Pin(MUX3_PIN)
    h.EQ1 = rpio.Pin(EQ1_PIN)
    h.EQ2 = rpio.Pin(EQ2_PIN)
    h.CS3.Output()
    h.CS4.Output()
    h.CS5.Output()
    h.CS6_1.Output()
    h.CS6_2.Output()
    h.CS6_3.Output()
    h.CS6_4.Output()
    h.MUX2.Output()
    h.MUX3.Output()
    h.EQ1.Output()
    h.EQ2.Output()
    h.CS3.Low()
    h.CS4.Low()
    h.CS5.Low()
    h.CS6_1.Low()
    h.CS6_2.Low()
    h.CS6_3.Low()
    h.CS6_4.Low()
    h.MUX2.Low()
    h.MUX3.Low()
    h.EQ1.Low()
    h.EQ2.Low()
    rpio.Pin(9).Output()
    rpio.Pin(10).Output()
    rpio.Pin(11).Output()
}

func (h *hardware) setupPCM1864() {
    // Open i2c bus
    var err error
    cmd := exec.Command("./setup_adc.sh")
    if err = cmd.Run(); err != nil {
	    log.Printf("Setup ADC: %v", err)
    }
    /*
    pcm1864, err := i2c.NewI2C(0x4a, 1)
    if err != nil {
        log.Printf("i2c.NewI2C: %v", err)
    }
    commands := [][]byte{
        // Clock 0001 Master Mode 0001 Auto Clock Detector
        []byte{0x20, 0x11}, 
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
    */
}

func (h *hardware) setupMAX5419() {
    var i uint8
    for i = 0; i < 8; i++ {
        max5419, err := i2c.NewI2C(0x28 + i, 1)
        if err != nil {
            log.Printf("i2c.NewI2C: %v", err)
        }
        //halfway point
        max5419.WriteBytes([]byte{0x11, 0xFE})
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
    log.Printf("42100: %08b, %08b", command, byte(data))
    if useHardware {
    h.CS3.Low()
    rpio.SpiTransmit(command, byte(data))
    h.CS3.High()
    }
}

func (h* hardware) setChannel(channel byte) {
    // convert channel to binary
    // set CS pins to binary
    channel = channel + 0x01
    log.Printf("Channel: %d", int(channel))
    if (channel % 2 == 0) {
        h.MUX2.High()
    } else {
        h.MUX2.Low()
    }
    if channel > 2 {
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
    max5419.Close()
}

// https://ww1.microchip.com/downloads/aemDocuments/documents/OTH/ProductDocuments/DataSheets/22060b.pdf
// Input 0 - 1023
func (h *hardware) writeMCP4131(channel byte, pin rpio.Pin, data int) {
    h.setChannel(channel)
    // xx00 -> write
    command := byte(0x00)
    // convert data to 10 bits, 2 bytes
    data = data & 0x3FF
    data1 := byte(data >> 8)
    data2 := byte(data & 0xFF)
    log.Printf("4131: %08b %08b", command | data1, byte(data))
    if useHardware {
    pin.Low()
    rpio.SpiTransmit(command | data1, data2)
    pin.High()
    }
}

var (
    be_table = []byte{0x00, 0x08, 0x04, 0x0C, 0x02, 0x0A, 0x06, 0x0E, 0x01, 0x09, 0x05}
    gain_table = []byte{0x07, 0x0B, 0x03, 0x0D, 0x05, 0x09, 0x00, 0x08, 0x04, 0x0C, 0x02, 0x0A, 0x06}
)
// gain is 0 - 127
func (h *hardware) writeEQ(channel byte, band byte, center_frequency byte, gain byte, Q byte) {
    EQ := h.EQ1
    if (channel > 2) {
        EQ = h.EQ2
    }
    channelsel := 0x8
    if (channel % 2 == 1) {
        channelsel = 0x4
    }
    byte1 := gain_table[gain] << 4 
    byte2 := be_table[center_frequency] << 4 | be_table[Q]
    byte3 := be_table[band] << 4 | byte(channelsel)
    log.Printf("EQ %08b %08b %08b", byte3, byte2, byte1)
    if useHardware {
    EQ.Low()
    rpio.SpiTransmit(0x86)
    time.Sleep(1*time.Microsecond)
    EQ.High()
    rpio.SpiTransmit(byte1, byte2, byte3)
    EQ.Low()
    }
}

func process_bytes(data []byte) [20]bool {
    var bools [20]bool
    for i := 0; i < 20; i++ {
	currbyte := data[i / 8]
	bit := byte(1 << (i % 8))
	if (currbyte & bit) == 0 {
		bools[i] = false
	} else {
		bools[i] = true
	}
	}
	return bools
}
