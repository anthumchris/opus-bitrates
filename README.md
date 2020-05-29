### Demo: https://opus-bitrates.anthum.com

# Opus Audio Bitrate Listening Test

The [Opus Codec](https://opus-codec.org/) allows us to have the smallest and highest-quality audio files on the web.  This demo shows the tradeoffs between file sizes and audio quality.

Not currently supported on Safari because of browser limitations.

# Developers

No build needed, just run a web server from the repo's root folder: `$ python3 -m http.server`

An `AudioWorklet` is used to instantly switch between decoded audio via an `AudioParam` passed by the UI that represents the array index of the decoded audio to play.  Latency is < 3ms when switching.  Synchronized playback is possible when switching because all of the decoded files contain the identical number of samples.  All files were encoded from the same source file using a constant bitrate to avoid any inconsistencies between decoded PCM data.

If you'd like to test your own files locally, encode a few files using the command below and provide [`BITRATES`](https://github.com/AnthumChris/opus-bitrates/blob/ad8f7f972e4660f13dbf431ae8b2c7964d9bd9e5/js/index.js#L1) values for the files you encoded.  Mind the memory usage because all files will be decoded and stored in the `AudioWorklet`.  That adds up if many long files are tested.
```
$ opusenc --hard-cbr --max-delay 0 --bitrate $BITRATE music.flac music-$BITRATE.opus
```
