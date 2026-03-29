// ============================================================
// LiveSessionService — Manages persistent Live API sessions
// ============================================================
// Handles bidirectional audio/text streaming with Prism's /ws/live
// endpoint, which proxies to Google's Gemini Live API.
// ============================================================

import { PRISM_WS_URL } from "../../config.js";

const LIVE_WS_URL = `${PRISM_WS_URL}/ws/live?project=retina&username=default`;

/**
 * Singleton-like service for managing a Live API WebSocket session.
 *
 * Usage:
 *   const session = new LiveSessionService();
 *   session.connect({ model, config, callbacks });
 *   session.startMicrophone();   // begins capturing audio
 *   session.stopMicrophone();
 *   session.sendText("Hello");
 *   session.disconnect();
 */
export default class LiveSessionService {
  constructor() {
    this.ws = null;
    this.audioContext = null; // Capture context (16kHz)
    this.playbackContext = null; // Playback context (24kHz)
    this.playbackWorkletNode = null; // Persistent playback worklet
    this.mediaStream = null;
    this.audioWorkletNode = null;
    this.isRecording = false;
    this.callbacks = {};
    this.connected = false;
  }

  // ── Connection ─────────────────────────────────────────────

  /**
   * Connect to Prism's /ws/live and set up a Live API session.
   * @param {object} params
   * @param {string} params.model - e.g. "gemini-3.1-flash-live-preview"
   * @param {object} [params.config] - Live API config (responseModalities, systemInstruction, etc.)
   * @param {object} params.callbacks - { onSetupComplete, onAudio, onText, onThinking, onToolCall, onInputTranscription, onOutputTranscription, onTurnComplete, onInterrupted, onError, onClose }
   */
  connect({ model, config = {}, callbacks = {} }) {
    this.callbacks = callbacks;

    if (this.ws) {
      this.disconnect();
    }

    this.ws = new WebSocket(LIVE_WS_URL);

    this.ws.onopen = () => {
      // Send setup message to initialize the Live API session
      this.ws.send(
        JSON.stringify({
          type: "setup",
          model,
          config,
        }),
      );
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this._handleMessage(data);
    };

    this.ws.onerror = (event) => {
      console.error("[LiveSession] WebSocket error:", event);
      if (this.callbacks.onError) {
        this.callbacks.onError("WebSocket connection error");
      }
    };

    this.ws.onclose = () => {
      this.connected = false;
      if (this.callbacks.onClose) {
        this.callbacks.onClose();
      }
    };
  }

  _handleMessage(data) {
    switch (data.type) {
      case "setupComplete":
        this.connected = true;
        if (this.callbacks.onSetupComplete) this.callbacks.onSetupComplete();
        break;

      case "audio":
        if (this.callbacks.onAudio) {
          this.callbacks.onAudio(data.data, data.mimeType);
        }
        // Auto-play audio if audio context exists
        this._playAudioChunk(data.data);
        break;

      case "text":
        if (this.callbacks.onText) this.callbacks.onText(data.text);
        break;

      case "thinking":
        if (this.callbacks.onThinking) this.callbacks.onThinking(data.content);
        break;

      case "toolCall":
        if (this.callbacks.onToolCall)
          this.callbacks.onToolCall(data.functionCalls);
        break;

      case "tool_execution":
        if (this.callbacks.onToolExecution) {
          this.callbacks.onToolExecution(data);
        }
        break;

      case "inputTranscription":
        if (this.callbacks.onInputTranscription) {
          this.callbacks.onInputTranscription(data.text);
        }
        break;

      case "outputTranscription":
        if (this.callbacks.onOutputTranscription) {
          this.callbacks.onOutputTranscription(data.text);
        }
        break;

      case "userAudioReady":
        if (this.callbacks.onUserAudioReady) {
          this.callbacks.onUserAudioReady(data.userAudioRef);
        }
        break;

      case "turnComplete":
        if (this.callbacks.onTurnComplete) this.callbacks.onTurnComplete(data);
        break;

      case "interrupted":
        this.stopAudioPlayback();
        if (this.callbacks.onInterrupted) this.callbacks.onInterrupted(data);
        break;

      case "usage":
        if (this.callbacks.onUsage) this.callbacks.onUsage(data.usage);
        break;

      case "error":
        if (this.callbacks.onError) this.callbacks.onError(data.message);
        break;

      case "sessionClosed":
        this.connected = false;
        if (this.callbacks.onClose) this.callbacks.onClose();
        break;
    }
  }

  disconnect() {
    this.stopMicrophone();
    this.stopAudioPlayback();
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "close" }));
      }
      this.ws.close();
      this.ws = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    if (this.playbackWorkletNode) {
      this.playbackWorkletNode.disconnect();
      this.playbackWorkletNode.port.close();
      this.playbackWorkletNode = null;
    }
    if (this.playbackContext) {
      this.playbackContext.close();
      this.playbackContext = null;
    }
    this._playbackInitPromise = null;
    this.connected = false;
  }

  // ── Input ──────────────────────────────────────────────────

  sendText(text) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "text", text }));
    }
  }

  sendToolResponse(responses) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "toolResponse", responses }));
    }
  }

  // ── Microphone ─────────────────────────────────────────────

  async startMicrophone() {
    if (this.isRecording) return;

    try {
      // Initialize AudioContext at 16kHz — Gemini's native input rate.
      // The browser handles hardware resampling from the mic's native
      // rate (typically 48kHz) down to 16kHz using a high-quality
      // polyphase resampler, eliminating manual downsampling.
      if (!this.audioContext) {
        this.audioContext = new (
          window.AudioContext || window.webkitAudioContext
        )({
          sampleRate: 16000,
        });
        await this.audioContext.audioWorklet.addModule("/pcm-processor.js");
      }

      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }

      // Get microphone stream with WebRTC audio processing
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const source = this.audioContext.createMediaStreamSource(
        this.mediaStream,
      );
      this.audioWorkletNode = new AudioWorkletNode(
        this.audioContext,
        "pcm-processor",
      );

      this.audioWorkletNode.port.onmessage = (event) => {
        if (!this.isRecording) return;

        // Already at 16kHz from the AudioContext — convert Float32 → Int16 PCM
        const pcm16 = this._convertFloat32ToInt16(event.data);

        // Send as base64 to Prism
        const base64 = this._arrayBufferToBase64(pcm16);
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(
            JSON.stringify({
              type: "audio",
              data: base64,
              mimeType: "audio/pcm;rate=16000",
            }),
          );
        }
      };

      // Connect mic → worklet (no output connection — prevents echo)
      source.connect(this.audioWorkletNode);

      this.isRecording = true;
    } catch (err) {
      console.error("[LiveSession] Microphone error:", err);
      throw err;
    }
  }

  stopMicrophone() {
    this.isRecording = false;
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.audioWorkletNode) {
      // Flush any remaining samples in the worklet's 512-sample buffer
      this.audioWorkletNode.port.postMessage("flush");
      this.audioWorkletNode.disconnect();
      this.audioWorkletNode.port.close();
      this.audioWorkletNode = null;
    }
    // Signal the Live API to flush any server-side cached audio
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "audioStreamEnd" }));
    }
  }

  // ── Audio Playback ─────────────────────────────────────────

  // Lazily create a dedicated 24kHz playback context with a persistent
  // AudioWorklet. The worklet maintains a ring buffer queue on the audio
  // thread — zero GC pressure, instant interrupt via single message.
  // Uses a memoized promise to prevent race conditions during init.
  _ensurePlaybackContext() {
    if (!this._playbackInitPromise) {
      this._playbackInitPromise = (async () => {
        this.playbackContext = new (
          window.AudioContext || window.webkitAudioContext
        )({
          sampleRate: 24000,
        });
        await this.playbackContext.audioWorklet.addModule(
          "/playback-processor.js",
        );
        this.playbackWorkletNode = new AudioWorkletNode(
          this.playbackContext,
          "playback-processor",
        );
        this.playbackWorkletNode.connect(this.playbackContext.destination);
      })();
    }
    return this._playbackInitPromise;
  }

  async _playAudioChunk(base64Data) {
    await this._ensurePlaybackContext();

    if (this.playbackContext.state === "suspended") {
      await this.playbackContext.resume();
    }

    try {
      // Decode base64 → Int16 PCM → Float32
      const binaryStr = atob(base64Data);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      const pcmData = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(pcmData.length);
      for (let i = 0; i < pcmData.length; i++) {
        float32[i] = pcmData[i] / 32768.0;
      }

      // Post directly to the worklet's ring buffer queue
      this.playbackWorkletNode.port.postMessage(float32);
    } catch (err) {
      console.error("[LiveSession] Audio playback error:", err);
    }
  }

  stopAudioPlayback() {
    if (this.playbackWorkletNode) {
      this.playbackWorkletNode.port.postMessage("interrupt");
    }
  }

  // ── Audio Utils ────────────────────────────────────────────

  _convertFloat32ToInt16(buffer) {
    const buf = new Int16Array(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
      buf[i] = Math.min(1, Math.max(-1, buffer[i])) * 0x7fff;
    }
    return buf.buffer;
  }

  _arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}
