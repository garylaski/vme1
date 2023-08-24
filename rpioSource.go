package main

import (
    _ "github.com/stianeikeland/go-rpio"
)

type gpioSource struct {
    // TODO
}

func (g *gpioSource) Init() (int, int, int) {
    // TODO
    return 0, 0, 0
}

func (g *gpioSource) Read() ([]byte, error) {
    // TODO
    return nil, nil
}
