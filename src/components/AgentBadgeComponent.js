"use client";

import { useRef, useCallback, useMemo, useEffect } from "react";
import { renderAgentIcon } from "./AgentPickerComponent";
import ThreeCanvasComponent from "./ThreeCanvasComponent";
import styles from "./AgentBadgeComponent.module.css";

// ── Agent gradient lookup ──────────────────────────────────────────
const AGENT_GRADIENTS = {
  CODING:   ["#6366f1", "#818cf8"],
  LUPOS:    ["#ef4444", "#f97316"],
  STICKERS: ["#10b981", "#34d399"],
  DIGEST:   ["#f59e0b", "#ef4444"],
  LIGHTS:   ["#eab308", "#f59e0b"],
  OOG:      ["#78716c", "#a8a29e"],
};
const FALLBACK_GRADIENT = ["#8b5cf6", "#06b6d4"];

function resolveGradient(agent) {
  if (agent?.color) return [agent.color, agent.color];
  return AGENT_GRADIENTS[agent?.id] || FALLBACK_GRADIENT;
}

// ── Canvas texture helpers ─────────────────────────────────────────

/** Draw a rounded-rect gradient fill on a canvas context. */
function drawGradientBase(ctx, s, gradient) {
  const r = s * 0.16;
  ctx.beginPath();
  ctx.roundRect(0, 0, s, s, r);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 0, s, s);
  g.addColorStop(0, gradient[0]);
  g.addColorStop(1, gradient[1]);
  ctx.fillStyle = g;
  ctx.fill();
}

/** Load an SVG string as an Image (returns a Promise). */
function loadSvgImage(svgMarkup) {
  return new Promise((resolve) => {
    const img = new Image();
    const blob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

// ── Static Coin Sub-component (flat, matches SVG badge) ────────────

const TEX_SIZE = 256;

/**
 * CoinStatic — renders the agent badge as a flat, unlit plane in Three.js
 * so it looks identical to the SVG badge but lives in a WebGL canvas.
 * Uses MeshBasicMaterial (no lighting needed) and pauses after the first
 * painted frame to avoid burning GPU on a static element.
 */
function CoinStatic({ agent, size }) {
  const meshRef = useRef(null);
  const texRef = useRef(null);
  const canvasRef = useRef(null);
  const iconRef = useRef(null);
  const hasPaintedRef = useRef(false);
  const gradient = useMemo(() => resolveGradient(agent), [agent]);

  // ── Three.js scene setup — single flat plane ──
  const handleSetup = useCallback(({ scene, camera, THREE }) => {
    // Orthographic-style: push camera back, use tight FOV so plane fills view
    camera.position.set(0, 0, 20);
    camera.lookAt(0, 0, 0);

    // No lights needed — MeshBasicMaterial is unlit

    // Build the texture canvas with gradient + rounded corners
    const texCanvas = document.createElement("canvas");
    texCanvas.width = TEX_SIZE;
    texCanvas.height = TEX_SIZE;
    const ctx = texCanvas.getContext("2d");
    drawGradientBase(ctx, TEX_SIZE, gradient);
    canvasRef.current = texCanvas;

    const tex = new THREE.CanvasTexture(texCanvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    texRef.current = tex;

    // Flat plane — no cylinder, no depth, no metalness
    const geo = new THREE.PlaneGeometry(1.6, 1.6);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geo, mat);
    meshRef.current = mesh;
    scene.add(mesh);

    hasPaintedRef.current = false;
  }, [gradient]);

  // ── Capture SVG icon from the hidden rendered element ──
  useEffect(() => {
    if (!iconRef.current) return;

    const raf = requestAnimationFrame(() => {
      const svg = iconRef.current?.querySelector("svg");
      if (!svg || !canvasRef.current) return;

      svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      const markup = svg.outerHTML.replace(/currentColor/g, "#ffffff");

      loadSvgImage(markup).then((img) => {
        if (!img || !canvasRef.current) return;
        const iconSz = TEX_SIZE * 0.55;
        const off = (TEX_SIZE - iconSz) / 2;

        const ctx = canvasRef.current.getContext("2d");
        ctx.drawImage(img, off, off, iconSz, iconSz);
        if (texRef.current) texRef.current.needsUpdate = true;
      });
    });

    return () => cancelAnimationFrame(raf);
  }, [agent]);

  // Continuous Y-axis rotation — smooth coin-flip loop
  const handleTick = useCallback(({ elapsed }) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.y = elapsed * 1.2;
  }, []);

  return (
    <>
      {/* Hidden icon render — React tree handles this naturally */}
      <span ref={iconRef} className={styles.hiddenIcon}>
        {renderAgentIcon(agent, Math.round(TEX_SIZE * 0.5))}
      </span>
      <ThreeCanvasComponent
        onSetup={handleSetup}
        onTick={handleTick}
        cameraFov={5}
        cameraPosition={[0, 0, 20]}
        alpha
        antialias
        toneMapping="None"
        className={styles.coinCanvas}
        style={{ width: size, height: size }}
      />
    </>
  );
}

// ── Main Component ─────────────────────────────────────────────────

/**
 * AgentBadgeComponent — Reusable rounded-square icon badge for an agent persona.
 *
 * @param {{ id?: string, icon?: string, color?: string }} agent
 * @param {number}  [size=30]         - Outer container size in px
 * @param {number}  [iconSize=15]     - Inner icon size in px
 * @param {boolean} [mini=false]      - Compact variant (22×22, 13px icon)
 * @param {boolean} [animation=false] - 3D coin-spin via Three.js
 * @param {string}  [className]
 */
export default function AgentBadgeComponent({
  agent,
  size = 30,
  iconSize = 15,
  mini = false,
  animation = false,
  className = "",
}) {
  const agentId = agent?.id || "";
  const resolvedSize = mini ? 22 : size;
  const resolvedIconSize = mini ? 13 : iconSize;

  if (animation) {
    return (
      <span className={`${styles.coinWrap} ${className}`}>
        {/* Key by agent ID so Three.js instance fully remounts on agent switch */}
        <CoinStatic key={agentId} agent={agent} size={resolvedSize} />
      </span>
    );
  }

  const inlineStyle = agent?.color
    ? {
        width: resolvedSize,
        height: resolvedSize,
        background: `linear-gradient(135deg, ${agent.color} 0%, color-mix(in srgb, ${agent.color} 70%, #fff) 100%)`,
      }
    : { width: resolvedSize, height: resolvedSize };

  return (
    <span
      className={`${styles.badge} ${mini ? styles.mini : ""} ${className}`}
      data-agent={agentId}
      style={inlineStyle}
    >
      {renderAgentIcon(agent, resolvedIconSize)}
    </span>
  );
}
