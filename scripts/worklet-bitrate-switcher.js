class BitrateSwitcher extends AudioWorkletProcessor {
  files = null
  currentFile
  readIdx = 0

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