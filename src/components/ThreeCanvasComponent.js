"use client";

import { useRef, useEffect, useCallback } from "react";
import ThreeService from "../services/ThreeService";
import styles from "./ThreeCanvasComponent.module.css";

/**
 * ThreeCanvasComponent — Declarative React wrapper over ThreeService.
 *
 * Renders a <canvas> element, creates a Three.js instance via ThreeService
 * on mount, and tears it down on unmount. Provides lifecycle hooks for
 * scene setup and per-frame animation.
 *
 * Architecture:
 *   - `onSetup(state)` fires once after the Three.js instance is created.
 *     Use it to add meshes, lights, materials, etc.
 *   - `onTick(state)` fires every frame. Use it for animation logic.
 *   - All GPU resources are deterministically disposed on unmount via
 *     ThreeService.destroy().
 *
 * Props:
 *   onSetup         — (state: SetupState) => void | cleanup function
 *   onTick          — (state: TickState) => void
 *   cameraFov       — Perspective camera FOV (default 60)
 *   cameraNear      — Near clipping plane (default 0.1)
 *   cameraFar       — Far clipping plane (default 1000)
 *   cameraPosition  — [x, y, z] initial camera position (default [0, 0, 5])
 *   antialias       — WebGL antialiasing (default true)
 *   alpha           — Transparent canvas background (default true)
 *   toneMapping     — Tone mapping preset string (default "ACESFilmic")
 *   toneMappingExposure — Exposure value (default 1)
 *   shadowMap       — Enable shadow maps (default false)
 *   paused          — Pause rendering (default false)
 *   className       — CSS class for the container div
 *   style           — Inline styles for the container div
 *
 * SetupState: { scene, camera, renderer, clock, THREE }
 * TickState:  { scene, camera, renderer, clock, dt, elapsed, width, height }
 */
export default function ThreeCanvasComponent({
  onSetup,
  onTick,
  cameraFov = 60,
  cameraNear = 0.1,
  cameraFar = 1000,
  cameraPosition = [0, 0, 5],
  antialias = true,
  alpha = true,
  toneMapping = "ACESFilmic",
  toneMappingExposure = 1,
  shadowMap = false,
  paused = false,
  className = "",
  style,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const instanceIdRef = useRef(null);
  const onTickRef = useRef(onTick);
  const setupCleanupRef = useRef(null);

  // Keep onTick ref current without re-creating the instance
  useEffect(() => {
    onTickRef.current = onTick;
  }, [onTick]);

  // Pause/resume reactively
  useEffect(() => {
    const id = instanceIdRef.current;
    if (!id) return;
    if (paused) {
      ThreeService.pause(id);
    } else {
      ThreeService.resume(id);
    }
  }, [paused]);

  // Stable tick wrapper that always calls the latest onTick ref
  const tickWrapper = useCallback((state) => {
    onTickRef.current?.(state);
  }, []);

  // ── Mount / Unmount lifecycle ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create the Three.js instance
    const id = ThreeService.create(canvas, {
      cameraFov,
      cameraNear,
      cameraFar,
      cameraPosition,
      antialias,
      alpha,
      toneMapping,
      toneMappingExposure,
      shadowMap,
    });

    instanceIdRef.current = id;

    // Register the tick callback
    ThreeService.setTick(id, tickWrapper);

    // Fire the setup callback — pass THREE so consumers don't import it
    const inst = ThreeService.getInstance(id);
    if (inst && onSetup) {
      const cleanup = onSetup({
        ...inst,
        THREE: ThreeService.THREE,
      });
      if (typeof cleanup === "function") {
        setupCleanupRef.current = cleanup;
      }
    }

    return () => {
      // Run user cleanup if provided
      setupCleanupRef.current?.();
      setupCleanupRef.current = null;

      // Destroy the Three.js instance (disposes all GPU resources)
      ThreeService.destroy(id);
      instanceIdRef.current = null;
    };
    // Intentionally only run on mount — renderer config is static
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      className={`${styles.container} ${className}`}
      style={style}
    >
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
}
