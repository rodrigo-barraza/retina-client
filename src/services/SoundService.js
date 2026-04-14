/**
 * SoundService — Procedural UI sound synthesis via Web Audio API.
 *
 * Generates tiny, GPU-friendly audio cues (hover ticks, clicks, etc.)
 * entirely in-memory using shaped noise buffers and sine sweeps.
 * No external audio files required.
 *
 * Stereo control: each play call accepts independent left/right
 * gain values (0–100) routed through a ChannelSplitter → per-channel
 * GainNode → ChannelMerger topology.
 */

/** @type {AudioContext|null} */
let ctx = null;

/** @type {AudioBuffer|null} Cached hover noise buffer */
let hoverBuffer = null;

/** @type {AudioBuffer|null} Cached click buffer */
let clickBuffer = null;

/**
 * Lazily initialise the shared AudioContext.
 * Must be called from a user-gesture context on first invocation.
 */
function ensureContext() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (ctx.state === "suspended") {
    ctx.resume();
  }
  return ctx;
}

// ─── Sound generators ──────────────────────────────────────────────

/**
 * Build (or return cached) a mono AudioBuffer containing a very
 * short filtered-noise hover tick.
 *
 * Technique: white noise → rapid exponential decay envelope.
 * Duration ~12 ms — imperceptibly brief, but enough for a
 * satisfying tactile "tick".
 */
function getHoverBuffer() {
  if (hoverBuffer) return hoverBuffer;

  const audio = ensureContext();
  const sampleRate = audio.sampleRate;
  const duration = 0.012; // 12 ms
  const length = Math.ceil(sampleRate * duration);

  hoverBuffer = audio.createBuffer(1, length, sampleRate);
  const data = hoverBuffer.getChannelData(0);

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    // White noise shaped by a steep exponential decay
    const noise = Math.random() * 2 - 1;
    const envelope = Math.exp(-t * 600);
    data[i] = noise * envelope * 0.025; // ultra-quiet base amplitude
  }

  return hoverBuffer;
}

/**
 * Build (or return cached) a mono AudioBuffer for a satisfying click.
 *
 * Technique: descending sine sweep (1800 → 400 Hz) layered with a
 * noise transient. The pitch drop gives it a "plop/pop" character
 * that feels tactile and premium. Slightly louder than the hover tick.
 * Duration ~25 ms.
 */
function getClickBuffer() {
  if (clickBuffer) return clickBuffer;

  const audio = ensureContext();
  const sampleRate = audio.sampleRate;
  const duration = 0.025; // 25 ms
  const length = Math.ceil(sampleRate * duration);

  clickBuffer = audio.createBuffer(1, length, sampleRate);
  const data = clickBuffer.getChannelData(0);

  const freqStart = 1800;
  const freqEnd = 400;

  let phase = 0;

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const progress = i / length;

    // Exponential frequency sweep from high → low
    const freq = freqStart * Math.pow(freqEnd / freqStart, progress);

    // Accumulate phase for smooth sine wave
    phase += (2 * Math.PI * freq) / sampleRate;

    // Sine body with steep exponential decay
    const sine = Math.sin(phase) * Math.exp(-t * 300);

    // Noise transient layer — only the first ~5 ms
    const noiseAmt = Math.exp(-t * 800);
    const noise = (Math.random() * 2 - 1) * noiseAmt * 0.3;

    // Combined — ~2× louder than hover tick
    data[i] = (sine * 0.06 + noise * 0.02);
  }

  return clickBuffer;
}

// ─── Stereo routing helper ─────────────────────────────────────────

/**
 * Route a source node through independent L/R gain stages and
 * connect to the destination.
 *
 * Topology:
 *   source → splitter(ch0) → gainL ─┐
 *                                     ├→ merger → destination
 *   source → splitter(ch1) → gainR ─┘
 *
 * Because the buffers are mono, the splitter outputs the same
 * signal on both channels. Each GainNode then scales independently
 * according to the caller's 0–100 value.
 *
 * @param {AudioBufferSourceNode} source
 * @param {number} left  — 0-100 left speaker volume
 * @param {number} right — 0-100 right speaker volume
 */
function connectStereo(source, left, right) {
  const audio = ensureContext();

  // Up-mix mono to stereo so the splitter has two channels
  const splitter = audio.createChannelSplitter(2);
  const merger = audio.createChannelMerger(2);

  const gainL = audio.createGain();
  const gainR = audio.createGain();

  gainL.gain.value = Math.max(0, Math.min(1, left / 100));
  gainR.gain.value = Math.max(0, Math.min(1, right / 100));

  // Source → splitter
  source.connect(splitter);

  // Splitter ch0 → gainL → merger ch0 (left)
  splitter.connect(gainL, 0);
  gainL.connect(merger, 0, 0);

  // Splitter ch1 → gainR → merger ch1 (right)
  splitter.connect(gainR, 0); // mono source only has ch0
  gainR.connect(merger, 0, 1);

  merger.connect(audio.destination);
}

// ─── Public API ────────────────────────────────────────────────────

const SoundService = {
  /**
   * Play the hover tick sound — ultra-quiet noise burst.
   *
   * @param {object}  [options]
   * @param {number}  [options.left=100]  — Left speaker volume 0-100
   * @param {number}  [options.right=100] — Right speaker volume 0-100
   */
  playHover({ left = 100, right = 100 } = {}) {
    const audio = ensureContext();
    const buffer = getHoverBuffer();

    const source = audio.createBufferSource();
    source.buffer = buffer;

    connectStereo(source, left, right);
    source.start(0);
  },

  /**
   * Play the click sound — descending sine sweep + noise transient.
   * Slightly louder and punchier than the hover tick.
   *
   * @param {object}  [options]
   * @param {number}  [options.left=100]  — Left speaker volume 0-100
   * @param {number}  [options.right=100] — Right speaker volume 0-100
   */
  playClick({ left = 100, right = 100 } = {}) {
    const audio = ensureContext();
    const buffer = getClickBuffer();

    const source = audio.createBufferSource();
    source.buffer = buffer;

    connectStereo(source, left, right);
    source.start(0);
  },

  /**
   * Tear down the AudioContext (e.g. on unmount / navigation).
   */
  dispose() {
    if (ctx) {
      ctx.close().catch(() => {});
      ctx = null;
    }
    hoverBuffer = null;
    clickBuffer = null;
  },
};

export default SoundService;
