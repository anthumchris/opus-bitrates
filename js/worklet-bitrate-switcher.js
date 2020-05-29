// receives a bunch of decoded audio files and switches between them in realtime
// All files must have equal sample lengths, otherwise playback sync is impossible
class BitrateSwitcher extends AudioWorkletProcessor {
  files = null  // all the decoded bitrate files with left/right channels
  currentFile   // current bitrate file playing
  readIdx = 0   // wrap-around pointer for reading files and looping

  // main thread signals a bitrate change via audioSrcIndex param
  static get parameterDescriptors () {
    return [{
      name: 'audioSrcIndex',
      defaultValue: -1
    }]
  }

  constructor() {
    super()
    this.port.onmessage = ({ data }) => {
      if (data.init) {
        this.files = data.init
        this.readIdx = 0
      }
    }
  }

  process(inputs, [[ outLeft, outRight ]], { audioSrcIndex }) {
    // set bitrate file to play
    const idx = audioSrcIndex[0]
    if (idx >= 0) {
      this.currentFile = this.files[idx]
    }

    // samples to read from
    const { pcmLeft, pcmRight } = this.currentFile

    // samples to write per quantum loop
    const maxCanWrite = outLeft.length // 128 frames currently
    let totalWritten = 0

    // TODO refactor to a simpler for loop
    // loop file when it gets to end of input buffer. iterates at most twice
    while (totalWritten < maxCanWrite) {
      // handle end of buffer max
      const num = Math.min(
        maxCanWrite - totalWritten,
        pcmLeft.length - 1 - this.readIdx
      )

      outLeft.set(pcmLeft.subarray(this.readIdx, this.readIdx + num), totalWritten)
      outRight.set(pcmRight.subarray(this.readIdx, this.readIdx + num), totalWritten)

      this.readIdx += num
      totalWritten += num

      // start over if end reached
      if (this.readIdx + 1 === pcmLeft.length)
        this.readIdx = 0
    }

    return true
  }
}

registerProcessor('bitrate-switcher', BitrateSwitcher)