/**
 * AudioWorklet processor that captures raw PCM audio samples.
 * Runs in the audio rendering thread — sends buffered Float32Array
 * chunks to the main thread via port.postMessage().
 *
 * Buffers 512 samples (~32ms at 16kHz) per Gemini Live API best
 * practices (recommended 20-40ms chunks) before posting, to reduce
 * postMessage overhead and WebSocket frame frequency.
 *
 * Input: raw audio from getUserMedia microphone (at AudioContext sampleRate)
 * Output: Float32Array chunks of 512 samples
 */
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 512;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;

    // Listen for flush command to send any remaining buffered audio
    this.port.onmessage = (event) => {
      if (event.data === "flush" && this.bufferIndex > 0) {
        this.port.postMessage(this.buffer.slice(0, this.bufferIndex));
        this.bufferIndex = 0;
      }
    };
  }

  process(inputs) {
    const input = inputs[0];
    if (input && input[0] && input[0].length > 0) {
      const channel = input[0];

      for (let i = 0; i < channel.length; i++) {
        this.buffer[this.bufferIndex++] = channel[i];

        if (this.bufferIndex >= this.bufferSize) {
          this.port.postMessage(this.buffer.slice());
          this.bufferIndex = 0;
        }
      }
    }
    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);
