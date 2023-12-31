package main

import (
    "net/http"
    "log"
    "github.com/gorilla/websocket"
    "time"
)

func main() {
    http.Handle("/", http.FileServer(http.Dir("./static")))
    http.HandleFunc("/ws", wsHandler)
    http.ListenAndServe(":8080", nil)
}

const (
    // The size we send per websocket message, bigger = better? 
    byteBufferSize = 1024
)

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
    data := make(chan []byte)
    done := make(chan struct{})
    // Run PCM data process its own thread
    go sendPCM(data, done)
    // Read PCM data from channel and send it over websocket
    for {
        select {
        case pcmData := <-data:
            err = conn.WriteMessage(websocket.BinaryMessage, pcmData)
            if err != nil {
                log.Printf("conn.WriteMessage: %v", err)
            }
        case <-done:
            return
        }
    }
}

// Interface for audio sources, e.g. wav file, gpio, etc.
type audioSource interface {
    Init() (sampleRate int, channels int, bitDepth int)
    Read() (buffer []byte, err error)
}

func sendPCM(data chan []byte, done chan struct{}) {
    defer close(done)
    // Create a source for PCM data
    var (
        source audioSource
        buf    []byte
        err    error
    )
    source = &wavSource{}
    sampleRate, numChans, bitDepth := source.Init()
    data <- pcmIntToBytes([]int{sampleRate, numChans, bitDepth}, 32)
    // Calculate the time between each PCM data send lol
    dt := time.Second * time.Duration(byteBufferSize / bitDepth) / (time.Duration(sampleRate))
    t := time.Now()
    for {
        if time.Since(t) >= dt {
            t = time.Now()
            if buf, err = source.Read(); err != nil {
                log.Printf("source.Read: %v", err)
            }
            if buf == nil {
                return
            }
            select {
            case data <- buf:
            default:
            }
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
