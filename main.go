package main

import (
    "net/http"
    "log"
    "strconv"
    "github.com/gorilla/websocket"
)
var h *hardware
func main() {
    
    h = &hardware{}
    h.Init()

    http.Handle("/", http.FileServer(http.Dir("./static")))
    http.HandleFunc("/ws", wsHandler)
    http.ListenAndServe(":8080", nil)
}

const (
    // The size we send per websocket message, bigger = better? 
    byteBufferSize = 1024*11
)

func processCommand(h *hardware, conn *websocket.Conn) {
    for {
        _, msg, err := conn.ReadMessage()
        if err != nil {
            log.Printf("conn.ReadMessage: %v", err)
            return
        }
        switch rune(msg[0]) {
            // change channel
        case 'c':
            //h.changePCM1864Channel(msg[1])
	    h.setChannel(byte(msg[1]) - 48)
	case 'p':
	    channel := byte(msg[1]) - 48
	    pan, _ := strconv.Atoi(string(msg[3:]))
	    pan = (254*pan)/100
	    h.writeEQ(channel, 6, 0, byte(pan/16), 10)
	    //h.writeMCP4131(channel, h.CS6, pan)
	case 'v':
	    channel := byte(msg[1]) - 48
	    vol, _ := strconv.Atoi(string(msg[3:]))
	    vol = (254*(100 - vol))/100
	    h.writeMCP4131(channel, h.CS5, vol)
	case 'g':
	    channel := byte(msg[1]) - 48
	    vol, _ := strconv.Atoi(string(msg[3:]))
	    vol = (256*vol)/100
	    h.writeMCP42100(channel, 1, vol)

        }

        if err != nil {
            log.Printf("changePCM1864Channel: %v", err)
        }
    }
}

func wsHandler(w http.ResponseWriter, r *http.Request) {
    // Create a websocket 
    upgrader := websocket.Upgrader{
        ReadBufferSize:  byteBufferSize,
        WriteBufferSize: byteBufferSize,
    }
    // Upgrade HTTP connection to websocket
    conn, err := upgrader.Upgrade(w, r, nil)
    if err != nil {
        log.Printf("upgrader.Upgrade: %v", err)
    }
    defer conn.Close()
    go processCommand(h, conn)
    data := make(chan []byte)
    done := make(chan struct{})
    // Run PCM data process its own thread
    go sendPCM(data, done)
    // Read Commands from websocket
    // Read PCM data from channel and send it over websocket
    for {
        select {
        case pcmData := <-data:
            err = conn.WriteMessage(websocket.BinaryMessage, pcmData)
            if err != nil {
                log.Printf("conn.WriteMessage: %v", err)
                return
            }
        case <-done:
            return
        }
    }
}

// Interface for audio sources, e.g. wav file, gpio, etc.
type audioSource interface {
    Init() (sampleRate int, channels int, bitDepth int)
    Read(buffer *[]byte) (err error)
    Close()
}

func sendPCM(data chan []byte, done chan struct{}) {
    defer close(done)
    // Create a source for PCM data
    var (
        source audioSource
        buf    []byte
        err    error
    )
    //source = &wavSource{}
    source = &goalsaSource{}
    defer source.Close()
    sampleRate, numChans, bitDepth := source.Init()
    data <- pcmIntToBytes([]int{sampleRate, numChans, bitDepth, byteBufferSize}, 32)
    buf = make([]byte, byteBufferSize)
    for {
        if err = source.Read(&buf); err != nil {
            log.Printf("source.Read: %v", err)
        }
        if buf == nil {
            continue
        }
        select {
        case data <- buf:
        default:
        }
    }
}

// Have to convert all our []int to []byte because of mismatching APIs, lol
// Depends on bit depth, e.g. 16-bit PCM little-endian:
// [ int32 ] -> [ byte, byte ]
// [ 0x0000FFFF ] -> [ 0xFF, 0xFF ]
func pcmIntToBytes(pcmData []int, bitDepth uint16) []byte {
    numSamples := len(pcmData)
    byteDepth := int(bitDepth) / 8
    byteData := make([]byte, numSamples*byteDepth)
    for i := 0; i < numSamples; i++ {
        sample := pcmData[i]
        for b := 0; b < byteDepth; b++ { 
            byteData[i*byteDepth+b] = byte(sample)
            sample >>= 8
        }
    }
    return byteData

}
