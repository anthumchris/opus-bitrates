// Opus bitrate files to test
const BITRATES = [2, 6, 10, 16, 32, 64, 96, 128, 192, 512].reverse()

const AUDIO_FOLDER_URL = 'audio/hyper',
      AUDIO_LOOP_START_MS = 2085

init(BITRATES)

async function init(bitrates) {
  if (/android.*chrome/i.test(navigator.userAgent)) {
    showWarning('Playback problems occur in Chrome 85 and below on Android. These may still exist in newer versions.')
  }
  if (!window.AudioWorklet) {
    return showError(Error('This browser does not support Audio Worklets. Please try a different browser.'))
  }

  // start paused
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'playback' })
  audioCtx.suspend()

  const [{ files, buffers }, workletNode] = await Promise.all([
    fetchAndDecode(bitrates, audioCtx),
    initAudioWorklet(audioCtx)
  ]).catch(showError)

  // transfer all decoded audio to Worklet
  workletNode.port.postMessage({ init: files }, buffers)

  // delay so 100% shows
  setTimeout(_ => initDOM(files, audioCtx, workletNode), 500)
}

function showWarning(msg) {
  document.querySelector('#warning').innerText = `⚠️ ${msg}`
}

function showError(e) {
  const status = document.querySelector('#status')
  status.classList.add('error')
  status.innerText = 'ERROR: ' + e.message
}

function initDOM(files, audioCtx, workletNode) {
  const btnPause = document.querySelector('#pause')
  btnPause.onclick = pause

  const wrapper = document.querySelector('.bitrates')
  const buttons = files.map((file, i) => {
    const btn = document.createElement('button')
    btn.addEventListener('mousedown', () => playBitrate(btn, file, i))
    btn.innerHTML = `<div class="bitrate">${file.bitrate}</div>kbit/s<div class="file-size">${fileSize(file.fileSize)}</div>`
    return btn
  })

  wrapper.innerHTML = ''
  wrapper.append(...buttons)

  function fileSize(size) {
    const kb = size/1024
    return `${kb.toLocaleString(navigator.language, { maximumFractionDigits: 1 })} KiB`
  }

  function pause() {
    audioCtx.suspend()
    btnPause.hidden = true
    resetButtons()
  }

  function resetButtons() {
    buttons.forEach(btn => btn.classList.remove('active'))
  }

  function playBitrate(button, file, index) {
    const srcParam = workletNode.parameters.get('audioSrcIndex')
    srcParam.setValueAtTime(index, audioCtx.currentTime)
    audioCtx.resume()

    resetButtons()
    button.classList.add('active')

    btnPause.hidden = false
  }
}


// Fetches Opus files and decodes them.
// resolves with { files, buffers }
async function fetchAndDecode(bitrates, audio) {
  // all decoded sample buffers for Transferrable postMessage
  const buffers = []

  // [{ bitrate, fileSize, pcmLeft, pcmRight }]
  const files = await Promise.all(bitrates.map(async bitrate => {
    const origResponse = await fetch(`${AUDIO_FOLDER_URL}/music-${bitrate}.webm`)
    const response = downloadProgressResponse(origResponse)
    const fileSize = response.headers.get('content-length')
    const audioBuffer = await audio.decodeAudioData(await response.arrayBuffer())
    ProgressManager.report({ decoded: 1 })
    const pcmLeft =  audioBuffer.getChannelData(0)
    const pcmRight = audioBuffer.getChannelData(1)
    buffers.push(pcmLeft.buffer, pcmRight.buffer)
    return { bitrate, fileSize, pcmLeft, pcmRight }
  }))

  return { files, buffers }
}

async function initAudioWorklet(audioCtx) {
  // ading random nonce to avoid reuse of cached file
  await audioCtx.audioWorklet.addModule('js/worklet-bitrate-switcher.js?'+Date.now())
  
  const workletNode = new AudioWorkletNode(audioCtx, 'bitrate-switcher', {
    outputChannelCount: [2],  // stereo
    processorOptions: {
      loopStartMs: AUDIO_LOOP_START_MS,  // optional. Milliseconds to start the loop (if music has an intro)
    },
  })
  workletNode.connect(audioCtx.destination)
  return workletNode
}


const ProgressManager = (function() {
  // weigh downloads more than decoder since they take longer
  // increases progress update frequency
  const downloadWeight = .8
  const decoderWeight = 1-downloadWeight

  const elProgress = document.querySelector('#loading')
  let totalToDownload = 0
  let totalDownloaded = 0
  let totalFiles = BITRATES.length
  let totalFilesRegistered = 0
  let totalDecoded = 0
  let lastTotalProgress = 0

  function register(fileSize) {
    totalToDownload += fileSize
    totalFilesRegistered++
    updateUI()
  }

  function report({ bytesDownloaded, decoded }) {
    totalDownloaded += bytesDownloaded || 0
    totalDecoded += decoded || 0
    updateUI()
  }

  function updateUI() {
    // reduce total progress until all files report
    const registeredDownloadsWeight = totalFilesRegistered / totalFiles

    const downloadProgress = totalDownloaded/totalToDownload * downloadWeight
    const decodeProgress = totalDecoded/totalFiles * decoderWeight
    const totalProgress = (downloadProgress + decodeProgress) * registeredDownloadsWeight

    // don't show backwards progress due to recalcs
    if (totalProgress < lastTotalProgress)
      return

    lastTotalProgress = totalProgress

    requestAnimationFrame(_ => {
      elProgress.innerText = Math.floor(totalProgress *100) + ' %'  
    })
  }

  return {
    register,
    report
  }  
})()


// Returns a new Response that also makes onProgress during download progress
function downloadProgressResponse(response) {
  if (!response.ok) {
    throw Error(response.status+' '+response.statusText)
  }

  if (!response.body) {
    throw Error('ReadableStream not yet supported in this browser.')
  }

  // to access headers, server must send CORS header "Access-Control-Expose-Headers: content-encoding, content-length x-file-size"
  // server must send custom x-file-size header if gzip or other content-encoding is used
  const contentEncoding = response.headers.get('content-encoding')
  const contentLength = response.headers.get(contentEncoding ? 'x-file-size' : 'content-length')
  if (contentLength === null) {
    throw Error('Response size header unavailable')
  }

  const total = parseInt(contentLength, 10)
  let bytesDownloaded = 0

  ProgressManager.register(total)

  return new Response(
    new ReadableStream({
      start(controller) {
        const reader = response.body.getReader()

        read()

        function read() {
          reader.read().then(({done, value}) => {
            if (done) {
              controller.close()
              return 
            }
            bytesDownloaded = value.byteLength
            ProgressManager.report({ bytesDownloaded })
            controller.enqueue(value)
            read()
          }).catch(error => {
            console.error(error)
            controller.error(error)                  
          })
        }
      }
    }),
    {
      headers: new Headers(response.headers)
    }
  )  
}

