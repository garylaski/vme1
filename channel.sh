#!/bin/sh
sudo i2cset -y 1 0x4a 0x06 $1
sudo i2cset -y 1 0x4a 0x07 $1
sudo i2cset -y 1 0x4a 0x08 $1
sudo i2cset -y 1 0x4a 0x09 $1
