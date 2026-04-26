/**
 * ThreeService — Three.js lifecycle manager for Retina.
 *
 * Provides a clean API for creating WebGL renderers, scenes, cameras,
 * and lighting rigs. Manages a shared requestAnimationFrame loop with
 * per-instance tick callbacks, DPR-aware resize handling, and
 * deterministic GPU resource disposal.
 *
 * Design:
 *   - Each "instance" gets its own renderer, scene, and camera, but they
 *     all share a single RAF loop to avoid frame budget contention.
 *   - The service is stateless/singleton — no React dependency. The
 *     ThreeCanvasComponent handles the React integration layer.
 *
 * Usage:
 *   const id = ThreeService.create(canvas, { cameraFov: 60 });
 *   ThreeService.setTick(id, (state) => { ... });
 *   ThreeService.destroy(id);
 */

import * as THREE from "three";

// ─── Instance Registry ─────────────────────────────────────────────

/** @type {Map<string, ThreeInstance>} */
const instances = new Map();

let nextId = 0;
let rafId = null;

/**
 * @typedef {object} ThreeInstance
 * @property {string}                   id
 * @property {HTMLCanvasElement}        canvas
 * @property {THREE.WebGLRenderer}      renderer
 * @property {THREE.Scene}              scene
 * @property {THREE.PerspectiveCamera}  camera
 * @property {Function|null}            tick      — per-frame callback (state) => void
 * @property {ResizeObserver|null}      resizeObserver
 * @property {number}                   width     — CSS width
 * @property {number}                   height    — CSS height
 * @property {boolean}                  paused
 */

// ─── RAF Loop ──────────────────────────────────────────────────────

function loop(timestamp) {
  for (const inst of instances.values()) {
    if (inst.paused) continue;

    inst.timer.update(timestamp);

    if (inst.tick) {
      inst.tick({
        scene: inst.scene,
        camera: inst.camera,
        renderer: inst.renderer,
        timer: inst.timer,
        dt: inst.timer.getDelta(),
        elapsed: inst.timer.getElapsed(),
        width: inst.width,
        height: inst.height,
      });
    }

    inst.renderer.render(inst.scene, inst.camera);
  }

  rafId = requestAnimationFrame(loop);
}

function ensureLoop() {
  if (rafId === null && instances.size > 0) {
    rafId = requestAnimationFrame(loop);
  }
}

function stopLoopIfEmpty() {
  if (instances.size === 0 && rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

// ─── Resize Handling ───────────────────────────────────────────────

function handleResize(inst) {
  const canvas = inst.canvas;
  const parent = canvas.parentElement;
  if (!parent) return;

  const rect = parent.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;

  if (w === 0 || h === 0) return;
  if (w === inst.width && h === inst.height) return;

  inst.width = w;
  inst.height = h;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  inst.renderer.setSize(w, h, false);
  inst.renderer.setPixelRatio(dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;

  inst.camera.aspect = w / h;
  inst.camera.updateProjectionMatrix();
}

// ─── Disposal Helpers ──────────────────────────────────────────────

/**
 * Recursively dispose geometries, materials, and textures in a scene
 * graph. This is critical to avoid GPU memory leaks.
 */
function disposeSceneGraph(object) {
  if (!object) return;

  // Traverse children first
  if (object.children) {
    for (let i = object.children.length - 1; i >= 0; i--) {
      disposeSceneGraph(object.children[i]);
    }
  }

  if (object.geometry) {
    object.geometry.dispose();
  }

  if (object.material) {
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];

    for (const mat of materials) {
      // Dispose all texture properties
      for (const key of Object.keys(mat)) {
        const value = mat[key];
        if (value && value instanceof THREE.Texture) {
          value.dispose();
        }
      }
      mat.dispose();
    }
  }
}

// ─── Public API ────────────────────────────────────────────────────

const ThreeService = {
  /**
   * Expose the THREE namespace so consumers don't need a separate import.
   * Keeps all Three.js dependency routing through this service.
   */
  THREE,

  /**
   * Create a new Three.js instance bound to the given canvas element.
   *
   * @param {HTMLCanvasElement} canvas
   * @param {object}  [options]
   * @param {number}  [options.cameraFov=60]       — Perspective camera FOV
   * @param {number}  [options.cameraNear=0.1]     — Near clipping plane
   * @param {number}  [options.cameraFar=1000]     — Far clipping plane
   * @param {Array}   [options.cameraPosition=[0,0,5]] — Initial camera position
   * @param {boolean} [options.antialias=true]      — WebGL antialiasing
   * @param {boolean} [options.alpha=true]          — Transparent background
   * @param {string}  [options.toneMapping="ACESFilmic"] — Tone mapping preset
   * @param {number}  [options.toneMappingExposure=1]
   * @param {boolean} [options.shadowMap=false]     — Enable shadow maps
   * @returns {string} Instance ID
   */
  create(canvas, options = {}) {
    const {
      cameraFov = 60,
      cameraNear = 0.1,
      cameraFar = 1000,
      cameraPosition = [0, 0, 5],
      antialias = true,
      alpha = true,
      toneMapping = "ACESFilmic",
      toneMappingExposure = 1,
      shadowMap = false,
    } = options;

    const id = `three-${nextId++}`;

    // ── Renderer ──
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias,
      alpha,
      powerPreference: "high-performance",
    });

    const toneMappingMap = {
      None: THREE.NoToneMapping,
      Linear: THREE.LinearToneMapping,
      Reinhard: THREE.ReinhardToneMapping,
      Cineon: THREE.CineonToneMapping,
      ACESFilmic: THREE.ACESFilmicToneMapping,
      AgX: THREE.AgXToneMapping,
      Neutral: THREE.NeutralToneMapping,
    };

    renderer.toneMapping = toneMappingMap[toneMapping] ?? THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = toneMappingExposure;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    if (shadowMap) {
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    // ── Scene ──
    const scene = new THREE.Scene();

    // ── Camera ──
    const camera = new THREE.PerspectiveCamera(
      cameraFov,
      1,
      cameraNear,
      cameraFar,
    );
    camera.position.set(...cameraPosition);

    // ── Timer ──
    const timer = new THREE.Timer();
    if (typeof document !== "undefined") timer.connect(document);

    // ── Instance ──
    const inst = {
      id,
      canvas,
      renderer,
      scene,
      camera,
      timer,
      tick: null,
      resizeObserver: null,
      width: 0,
      height: 0,
      paused: false,
    };

    instances.set(id, inst);

    // Initial sizing
    handleResize(inst);

    // Observe container resizes
    const parent = canvas.parentElement;
    if (parent && typeof ResizeObserver !== "undefined") {
      inst.resizeObserver = new ResizeObserver(() => handleResize(inst));
      inst.resizeObserver.observe(parent);
    }

    ensureLoop();
    return id;
  },

  /**
   * Register a per-frame tick callback for an instance.
   *
   * @param {string}   id
   * @param {Function} fn — (state: TickState) => void
   *
   * TickState: { scene, camera, renderer, timer, dt, elapsed, width, height }
   */
  setTick(id, fn) {
    const inst = instances.get(id);
    if (inst) inst.tick = fn;
  },

  /**
   * Pause rendering for an instance (e.g. when off-screen).
   * @param {string} id
   */
  pause(id) {
    const inst = instances.get(id);
    if (inst) inst.paused = true;
  },

  /**
   * Resume rendering for a paused instance.
   * @param {string} id
   */
  resume(id) {
    const inst = instances.get(id);
    if (inst) inst.paused = false;
  },

  /**
   * Get the scene, camera, and renderer for an instance.
   * Useful for imperative setup (adding meshes, lights, etc.).
   *
   * @param {string} id
   * @returns {{ scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer } | null}
   */
  getInstance(id) {
    const inst = instances.get(id);
    if (!inst) return null;
    return {
      scene: inst.scene,
      camera: inst.camera,
      renderer: inst.renderer,
      timer: inst.timer,
    };
  },

  // ── Scene Graph Helpers ───────────────────────────────────────

  /**
   * Create a standard three-point lighting rig and add it to a scene.
   *
   * @param {THREE.Scene} scene
   * @param {object} [options]
   * @param {number} [options.ambientIntensity=0.4]
   * @param {number} [options.keyIntensity=1.0]
   * @param {number} [options.fillIntensity=0.5]
   * @param {number} [options.rimIntensity=0.3]
   * @param {string} [options.ambientColor="#404060"]
   * @param {string} [options.keyColor="#ffffff"]
   * @param {string} [options.fillColor="#8888ff"]
   * @param {string} [options.rimColor="#ff8844"]
   * @returns {{ ambient: THREE.AmbientLight, key: THREE.DirectionalLight, fill: THREE.DirectionalLight, rim: THREE.PointLight }}
   */
  addLightingRig(scene, options = {}) {
    const {
      ambientIntensity = 0.4,
      keyIntensity = 1.0,
      fillIntensity = 0.5,
      rimIntensity = 0.3,
      ambientColor = "#404060",
      keyColor = "#ffffff",
      fillColor = "#8888ff",
      rimColor = "#ff8844",
    } = options;

    const ambient = new THREE.AmbientLight(ambientColor, ambientIntensity);
    scene.add(ambient);

    const key = new THREE.DirectionalLight(keyColor, keyIntensity);
    key.position.set(5, 5, 5);
    scene.add(key);

    const fill = new THREE.DirectionalLight(fillColor, fillIntensity);
    fill.position.set(-3, 2, -2);
    scene.add(fill);

    const rim = new THREE.PointLight(rimColor, rimIntensity, 20);
    rim.position.set(0, 3, -5);
    scene.add(rim);

    return { ambient, key, fill, rim };
  },

  /**
   * Create a mesh with geometry and material, optionally adding it to a scene.
   *
   * @param {THREE.BufferGeometry} geometry
   * @param {THREE.Material}       material
   * @param {THREE.Scene}         [scene] — if provided, the mesh is added to the scene
   * @returns {THREE.Mesh}
   */
  createMesh(geometry, material, scene) {
    const mesh = new THREE.Mesh(geometry, material);
    if (scene) scene.add(mesh);
    return mesh;
  },

  /**
   * Create a fog configuration on a scene.
   *
   * @param {THREE.Scene} scene
   * @param {string}      color — Hex color
   * @param {number}      near
   * @param {number}      far
   */
  addFog(scene, color, near = 5, far = 30) {
    scene.fog = new THREE.Fog(color, near, far);
  },

  /**
   * Set the scene background color.
   *
   * @param {THREE.Scene}      scene
   * @param {string|null}      color — Hex color string or null for transparent
   */
  setBackground(scene, color) {
    scene.background = color ? new THREE.Color(color) : null;
  },

  // ── Post-Processing Prep ─────────────────────────────────────

  /**
   * Placeholder for future EffectComposer integration.
   * Returns null until post-processing passes are needed.
   *
   * @param {string} _id
   * @returns {null}
   */
  getComposer(_id) {
    return null;
  },

  // ── Cleanup ──────────────────────────────────────────────────

  /**
   * Destroy a Three.js instance — disposes all GPU resources,
   * removes from the loop, and disconnects the ResizeObserver.
   *
   * @param {string} id
   */
  destroy(id) {
    const inst = instances.get(id);
    if (!inst) return;

    // Stop observing
    inst.resizeObserver?.disconnect();

    // Dispose scene graph (geometries, materials, textures)
    disposeSceneGraph(inst.scene);

    // Dispose renderer (WebGL context)
    inst.renderer.dispose();

    // Remove from registry
    instances.delete(id);
    stopLoopIfEmpty();
  },

  /**
   * Destroy all instances. Nuclear option for route transitions.
   */
  destroyAll() {
    for (const id of [...instances.keys()]) {
      this.destroy(id);
    }
  },

  /**
   * Get the count of active instances (for debugging).
   * @returns {number}
   */
  get activeCount() {
    return instances.size;
  },
};

export default ThreeService;
