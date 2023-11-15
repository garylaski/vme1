// the following code is from https://github.com/samirkumardas/pcm-player
class PCMPlayer {
  constructor(option) {
    this.init(option)
  }

  init(option) {
    const defaultOption = {
      inputCodec: 'Int16', 
      channels: 1, 
      sampleRate: 8000, 
      flushTime: 1000 
    }

    this.option = Object.assign({}, defaultOption, option) 
    this.samples = new Float32Array() 
    this.interval = setInterval(this.flush.bind(this), this.option.flushTime)
    this.convertValue = this.getConvertValue()
    this.typedArray = this.getTypedArray()
    this.initAudioContext()
    this.bindAudioContextEvent()
  }

  getConvertValue() {
    const inputCodecs = {
      'Int8': 128,
      'Int16': 32768,
      'Int32': 2147483648,
      'Float32': 1
    }
    if (!inputCodecs[this.option.inputCodec]) throw new Error('wrong codec.please input one of these codecs:Int8,Int16,Int32,Float32')
    return inputCodecs[this.option.inputCodec]
  }

  getTypedArray() {
    const typedArrays = {
      'Int8': Int8Array,
      'Int16': Int16Array,
      'Int32': Int32Array,
      'Float32': Float32Array
    }
    if (!typedArrays[this.option.inputCodec]) throw new Error('wrong codec.please input one of these codecs:Int8,Int16,Int32,Float32')
    return typedArrays[this.option.inputCodec]
  }

  initAudioContext() {
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: this.option.sampleRate
    });
    this.gainNode = this.audioCtx.createGain()
    this.gainNode.gain.value = 0.1
    this.gainNode.connect(this.audioCtx.destination)
    this.startTime = this.audioCtx.currentTime
  }

  static isTypedArray(data) {
    return (data.byteLength && data.buffer && data.buffer.constructor == ArrayBuffer) || data.constructor == ArrayBuffer;
  }

  isSupported(data) {
    if (!PCMPlayer.isTypedArray(data)) throw new Error('请传入ArrayBuffer或者任意TypedArray')
    return true
  }

  feed(data) {
    this.isSupported(data)

    data = this.getFormatedValue(data);
    const tmp = new Float32Array(this.samples.length + data.length);
    tmp.set(this.samples, 0);
    tmp.set(data, this.samples.length);
    this.samples = tmp;
  }

  getFormatedValue(data) {
    if (data.constructor == ArrayBuffer) {
      data = new this.typedArray(data)
    } else {
      data = new this.typedArray(data.buffer)
    }

    let float32 = new Float32Array(data.length)

    for (let i = 0; i < data.length; i++) {
      float32[i] = data[i] / this.convertValue
    }
    return float32
  }

  volume(volume) {
    this.gainNode.gain.value = volume
  }

  destroy() {
    if (this.interval) {
      clearInterval(this.interval)
    }
    this.samples = null
    this.audioCtx.close()
    this.audioCtx = null
  }

  flush() {
    if (!this.samples.length) return
    const self = this
    var bufferSource = this.audioCtx.createBufferSource()
    if (typeof this.option.onended === 'function') {
      bufferSource.onended = function (event) {
        self.option.onended(this, event)
      }
    }
    const length = this.samples.length / this.option.channels
    const audioBuffer = this.audioCtx.createBuffer(this.option.channels, length, this.option.sampleRate)

    for (let channel = 0; channel < this.option.channels; channel++) {
      const audioData = audioBuffer.getChannelData(channel)
      let offset = channel
      let decrement = 50
      for (let i = 0; i < length; i++) {
        audioData[i] = this.samples[offset]
        offset += this.option.channels
      }
    }

    if (this.startTime < this.audioCtx.currentTime) {
      this.startTime = this.audioCtx.currentTime
    }
    bufferSource.buffer = audioBuffer
    bufferSource.connect(this.gainNode)
    bufferSource.start(this.startTime)
    this.startTime += audioBuffer.duration
    this.samples = new Float32Array()
  }

  async pause() {
    await this.audioCtx.suspend()
  }

  async continue() {
    await this.audioCtx.resume()
  }

  bindAudioContextEvent() {
    const self = this
    if (typeof self.option.onstatechange === 'function') {
      this.audioCtx.onstatechange = function (event) {
        self.option.onstatechange(this, event, self.audioCtx.state)
      }
    }
  }
}
export default PCMPlayer
