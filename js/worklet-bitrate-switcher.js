// receives a bunch of decoded audio files and switches between them in realtime
// All files must have equal sample lengths, otherwise playback sync is impossible
class BitrateSwitcher extends AudioWorkletProcessor {
  files = null  // all the decoded bitrate files with left/right channels
  currentFile   // current bitrate file playing
  readIdx       // wrap-around pointer for reading files and looping
  loopStartIdx  // Normally zero unless your loop file has an intro

  // main thread signals a bitrate change via audioSrcIndex param
  static get parameterDescriptors () {
    return [{
      name: 'audioSrcIndex',
      defaultValue: -1
    }]
  }

  constructor(options) {
    super()
    this.port.onmessage = ({ data }) => {
      if (data.init) {
        this.files = data.init
        this.readIdx = 0
        this.loopStartIdx = Math.round((options.processorOptions?.loopStartMs || 0) * sampleRate / 1000)
      }
    }
  }

  // play and loop audio when it ends
  process(inputs, [[ outLeft, outRight ]], { audioSrcIndex }) {
    // set bitrate file to play
    this._idx = audioSrcIndex[0]
    if (this._idx >= 0) {
      this.currentFile = this.files[this._idx]
    }

    for (let i=0; i < outLeft.length; i++, this.readIdx++) {
      // wrap around and loop at end
      if (this.readIdx === this.currentFile.pcmLeft.length) {
        this.readIdx = this.loopStartIdx
      }

      outLeft[i] = this.currentFile.pcmLeft[this.readIdx]
      outRight[i] = this.currentFile.pcmRight[this.readIdx]
    }

    return true
  }
}

registerProcessor('bitrate-switcher', BitrateSwitcher)