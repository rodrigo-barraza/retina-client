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

// ── Coin Spin Sub-component ────────────────────────────────────────

const TEX_SIZE = 256;

function CoinSpin({ agent, size }) {
  const pivotRef = useRef(null);
  const frontTexRef = useRef(null);
  const frontCanvasRef = useRef(null);
  const backTexRef = useRef(null);
  const backCanvasRef = useRef(null);
  const iconRef = useRef(null);
  const gradient = useMemo(() => resolveGradient(agent), [agent]);

  // ── Three.js scene setup ──
  const handleSetup = useCallback(({ scene, camera, THREE }) => {
    camera.position.set(0, 0, 3.2);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.AmbientLight("#ffffff", 0.8));
    const key = new THREE.DirectionalLight("#ffffff", 1.2);
    key.position.set(2, 3, 4);
    scene.add(key);
    const rim = new THREE.PointLight("#ffffff", 0.5, 10);
    rim.position.set(-2, 1, -3);
    scene.add(rim);

    const geo = new THREE.CylinderGeometry(1.1, 1.1, 0.12, 48, 1);

    // Front face canvas (icon painted in useEffect)
    const fCanvas = document.createElement("canvas");
    fCanvas.width = TEX_SIZE;
    fCanvas.height = TEX_SIZE;
    drawGradientBase(fCanvas.getContext("2d"), TEX_SIZE, gradient);
    frontCanvasRef.current = fCanvas;

    const frontTex = new THREE.CanvasTexture(fCanvas);
    frontTex.colorSpace = THREE.SRGBColorSpace;
    frontTexRef.current = frontTex;
    const frontMat = new THREE.MeshStandardMaterial({
      map: frontTex, metalness: 0.3, roughness: 0.4,
    });

    // Back face: same canvas, mirrored via Three.js texture repeat
    const bCanvas = document.createElement("canvas");
    bCanvas.width = TEX_SIZE;
    bCanvas.height = TEX_SIZE;
    drawGradientBase(bCanvas.getContext("2d"), TEX_SIZE, gradient);
    backCanvasRef.current = bCanvas;

    const backTex = new THREE.CanvasTexture(bCanvas);
    backTex.colorSpace = THREE.SRGBColorSpace;
    backTexRef.current = backTex;
    const backMat = new THREE.MeshStandardMaterial({
      map: backTex, metalness: 0.3, roughness: 0.4,
    });

    // Rim
    const rimMat = new THREE.MeshStandardMaterial({
      color: gradient[0], metalness: 0.6, roughness: 0.3,
    });

    // [side, top-cap (front), bottom-cap (back)]
    const coin = new THREE.Mesh(geo, [rimMat, frontMat, backMat]);
    const pivot = new THREE.Group();
    pivot.add(coin);
    coin.rotation.x = Math.PI / 2;

    pivotRef.current = pivot;
    scene.add(pivot);
  }, [gradient]);

  // ── Capture SVG icon from the hidden rendered element ──
  useEffect(() => {
    if (!iconRef.current) return;

    // Wait a frame for the SVG to be painted in the DOM
    const raf = requestAnimationFrame(() => {
      const svg = iconRef.current?.querySelector("svg");
      if (!svg || !frontCanvasRef.current) return;

      svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      const markup = svg.outerHTML.replace(/currentColor/g, "#ffffff");

      loadSvgImage(markup).then((img) => {
        if (!img) return;
        const iconSz = TEX_SIZE * 0.55;
        const off = (TEX_SIZE - iconSz) / 2;

        // Front face: icon drawn normally
        if (frontCanvasRef.current) {
          const fCtx = frontCanvasRef.current.getContext("2d");
          fCtx.drawImage(img, off, off, iconSz, iconSz);
          if (frontTexRef.current) frontTexRef.current.needsUpdate = true;
        }

        // Back face: icon drawn mirrored via temp canvas
        if (backCanvasRef.current) {
          const tmp = document.createElement("canvas");
          tmp.width = TEX_SIZE;
          tmp.height = TEX_SIZE;
          const tCtx = tmp.getContext("2d");
          tCtx.drawImage(img, off, off, iconSz, iconSz);

          const bCtx = backCanvasRef.current.getContext("2d");
          bCtx.save();
          bCtx.translate(TEX_SIZE, 0);
          bCtx.scale(-1, 1);
          bCtx.drawImage(tmp, 0, 0);
          bCtx.restore();
          if (backTexRef.current) backTexRef.current.needsUpdate = true;
        }
      });
    });

    return () => cancelAnimationFrame(raf);
  }, [agent]);

  const handleTick = useCallback(({ elapsed }) => {
    if (!pivotRef.current) return;
    // Static back face for testing
    pivotRef.current.rotation.y = Math.PI; 
    pivotRef.current.position.y = 0;
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
        cameraFov={30}
        cameraPosition={[0, 0, 3.2]}
        alpha
        antialias
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
        <CoinSpin agent={agent} size={resolvedSize} />
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
