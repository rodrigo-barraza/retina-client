/**
 * AudioWorklet processor for real-time PCM audio playback.
 * Uses a ring buffer queue with offset tracking — zero allocations
 * on the audio thread. Fills silence when the queue is empty.
 *
 * Messages from main thread:
 *   Float32Array  → enqueue audio data
 *   "interrupt"   → clear queue instantly (barge-in)
 *
 * Output: mono audio at the AudioContext's sample rate (24kHz for Gemini)
 */
class PlaybackProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.audioQueue = [];
    this.currentOffset = 0;

    this.port.onmessage = (event) => {
      if (event.data === "interrupt") {
        this.audioQueue = [];
        this.currentOffset = 0;
      } else if (event.data instanceof Float32Array) {
        this.audioQueue.push(event.data);
      }
    };
  }

  process(inputs, outputs) {
    const output = outputs[0];
    if (output.length === 0) return true;

    const channel = output[0];
    let outputIndex = 0;

    // Fill output buffer from the queue
    while (outputIndex < channel.length && this.audioQueue.length > 0) {
      const currentBuffer = this.audioQueue[0];

      if (!currentBuffer || currentBuffer.length === 0) {
        this.audioQueue.shift();
        this.currentOffset = 0;
        continue;
      }

      const remainingOutput = channel.length - outputIndex;
      const remainingBuffer = currentBuffer.length - this.currentOffset;
      const copyLength = Math.min(remainingOutput, remainingBuffer);

      // Copy using offset tracking (no slice allocation)
      for (let i = 0; i < copyLength; i++) {
        channel[outputIndex++] = currentBuffer[this.currentOffset++];
      }

      // Consumed entire buffer — advance to next
      if (this.currentOffset >= currentBuffer.length) {
        this.audioQueue.shift();
        this.currentOffset = 0;
      }
    }

    // Fill remaining output with silence (prevents glitches)
    while (outputIndex < channel.length) {
      channel[outputIndex++] = 0;
    }

    return true;
  }
}

registerProcessor("playback-processor", PlaybackProcessor);
