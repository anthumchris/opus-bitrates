### Demo: https://opus-bitrates.anthum.com

# Opus Audio Bitrate Listening Test

The [Opus Codec](https://opus-codec.org/) allows us to have the smallest and highest-quality audio files on the web.  This demo shows the tradeoffs between file sizes and audio quality.

Mobile Chrome 85 and below on Android results in choppy audio playback ([Chromium issue #1090441](https://bugs.chromium.org/p/chromium/issues/detail?id=1090441)).

# Developers

No build needed, just run a web server from the repo's root folder: `$ python3 -m http.server`

An `AudioWorklet` is used to instantly switch between decoded audio via an `AudioParam` passed by the UI that represents the array index of the decoded audio to play.  Latency is < 3ms when switching.  Synchronized playback is possible when switching because all of the decoded files contain the identical number of samples.  All files were encoded from the same source file using a constant bitrate to avoid any inconsistencies between decoded PCM data.

If you'd like to test your own files locally, encode files using the `opusenc` ([opus-tools](https://opus-codec.org/downloads/)) and [ffmpeg](https://ffmpeg.org) commands below and provide [`BITRATES`](https://github.com/AnthumChris/opus-bitrates/blob/master/js/index.js#L1) values for the files you encoded.  Mind the memory usage because all files will be decoded and stored in the `AudioWorklet`.  That adds up if many long files are tested.

```bash
#!/usr/bin/env bash
for BITRATE in 2 6 10 16 32 64 96 128 192 512
do
  opusenc --hard-cbr --max-delay 0 --bitrate $BITRATE music.wav music-$BITRATE.opus
  ffmpeg -i music-$BITRATE.opus -c copy music-$BITRATE.webm  # Safari/Webkit support
done
```
