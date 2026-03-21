"use client";

import { usePathname } from "next/navigation";
import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  ScrollText,
  MessageSquare,
  ArrowLeft,
  Server,
  DollarSign,
  GitBranch,
  Sun,
  Moon,
  Image as ImageIcon,
  Layers,
  Type,
  Workflow,
  Settings,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { useTheme } from "./ThemeProvider";
import styles from "./NavigationSidebarComponent.module.css";

/** 8-bit dithered rainbow — auto-animates, mouse accelerates it */
const PIXEL_SIZE = 6;
const BASE_SPEED = 30; // degrees/sec
const DECAY = 0.92; // velocity decay per frame
const RAINBOW = [
  [255, 0, 0],
  [255, 127, 0],
  [255, 255, 0],
  [0, 200, 80],
  [0, 120, 255],
  [100, 0, 255],
  [255, 0, 150],
];

function lerpColor(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

function rainbowAt(t) {
  // t in [0,1] → interpolated rainbow color
  const scaled = ((t % 1) + 1) % 1 * RAINBOW.length;
  const i = Math.floor(scaled);
  const f = scaled - i;
  return lerpColor(RAINBOW[i % RAINBOW.length], RAINBOW[(i + 1) % RAINBOW.length], f);
}

function RainbowCanvas() {
  const canvasRef = useRef(null);
  const stateRef = useRef({ offset: 0, boost: 0, lastTime: 0, lastMouse: null });

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    const { width, height } = canvas;
    const cols = Math.ceil(width / PIXEL_SIZE);
    const rows = Math.ceil(height / PIXEL_SIZE);
    const s = stateRef.current;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        // Diagonal gradient offset + time offset
        const t = (x / cols + y / rows) * 0.5 + s.offset / 360;
        // Dither: slight per-pixel noise for that 8-bit feel
        const dither = ((x * 7 + y * 13) % 5) / 40;
        const [r, g, b] = rainbowAt(t + dither);
        ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
        ctx.fillRect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
      }
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    let rafId;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = parent.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + "px";
      canvas.style.height = rect.height + "px";
      const ctx = canvas.getContext("2d", { alpha: false });
      ctx.scale(dpr, dpr);
      // Reset canvas dimensions for drawing in CSS pixels
      canvas.width = rect.width;
      canvas.height = rect.height;
    };

    const onMouseMove = (e) => {
      const s = stateRef.current;
      if (s.lastMouse) {
        const dx = e.clientX - s.lastMouse.x;
        const dy = e.clientY - s.lastMouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        s.boost += dist * 4;
      }
      s.lastMouse = { x: e.clientX, y: e.clientY };
    };

    const tick = (now) => {
      const s = stateRef.current;
      if (!s.lastTime) s.lastTime = now;
      const dt = (now - s.lastTime) / 1000;
      s.lastTime = now;

      const speed = BASE_SPEED + s.boost;
      s.offset = (s.offset + speed * dt) % 360;
      s.boost *= DECAY;
      if (s.boost < 0.5) s.boost = 0;

      draw();
      rafId = requestAnimationFrame(tick);
    };

    resize();
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("resize", resize);
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", resize);
    };
  }, [draw]);

  return <canvas ref={canvasRef} className={styles.rainbowCanvas} />;
}

const USER_NAV_ITEMS = [
  { href: "/", label: "Conversations", icon: MessageSquare, exact: true },
  { href: "/workflows", label: "Workflows", icon: Workflow },
  { href: "/models", label: "Models", icon: Server },
  { href: "/media", label: "Media", icon: ImageIcon },
  { href: "/text", label: "Text", icon: Type },
];

const ADMIN_NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/requests", label: "Requests", icon: ScrollText },
  {
    href: "/admin/conversations",
    label: "Conversations",
    icon: MessageSquare,
    showBadge: true,
  },
  { href: "/admin/workflows", label: "Workflows", icon: GitBranch },
  { href: "/admin/providers", label: "Providers", icon: Layers },
  { href: "/admin/media", label: "Media", icon: ImageIcon },
  { href: "/admin/text", label: "Text", icon: Type },
  { href: "/admin/usage", label: "Usage", icon: DollarSign },
  { href: "/admin/models", label: "Models", icon: Server },
];

export default function NavigationSidebarComponent({
  mode = "user",
  liveCount = 0,
  systemStatus = "connected",
  onNavClick,
}) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [showNav, setShowNav] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("panel_nav");
    if (stored !== null) setShowNav(stored === "true");
  }, []);

  const toggleNav = useCallback(() => {
    setShowNav((prev) => {
      const next = !prev;
      localStorage.setItem("panel_nav", String(next));
      return next;
    });
  }, []);

  const navItems = mode === "admin" ? ADMIN_NAV_ITEMS : USER_NAV_ITEMS;
  const isAdmin = mode === "admin";

  return (
    <div className={`${styles.wrapper} ${!showNav ? styles.collapsed : ""}`}>
      {/* Collapsed: just a toggle strip */}
      {!showNav && (
        <button
          className={styles.expandBtn}
          onClick={toggleNav}
          title="Show navigation"
        >
          <ChevronsRight size={16} />
        </button>
      )}

      {/* Expanded sidebar */}
      <aside className={styles.sidebar}>
        {/* Rainbow logo banner */}
        <div className={styles.logoBanner}>
          <RainbowCanvas />
          <button
            className={styles.collapseBtn}
            onClick={toggleNav}
            title="Hide navigation"
          >
            <ChevronsLeft size={14} />
          </button>
        </div>

        {/* Navigation */}
        <nav className={styles.nav}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navLink} ${isActive ? styles.active : ""}`}
                onClick={() => onNavClick?.(item.href)}
              >
                <Icon className={styles.navIcon} />
                <span className={styles.navLabel}>{item.label}</span>
                {item.showBadge && liveCount > 0 && (
                  <span className={`${styles.badge} ${styles.live}`}>
                    {liveCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className={styles.footer}>
          {isAdmin ? (
            <Link href="/" className={styles.navLink}>
              <ArrowLeft className={styles.navIcon} />
              <span className={styles.navLabel}>Back to Retina</span>
            </Link>
          ) : (
            <Link href="/admin" className={styles.navLink}>
              <Settings className={styles.navIcon} />
              <span className={styles.navLabel}>Admin</span>
            </Link>
          )}
          <button className={styles.navLink} onClick={toggleTheme}>
            {theme === "dark" ? (
              <Sun className={styles.navIcon} />
            ) : (
              <Moon className={styles.navIcon} />
            )}
            <span className={styles.navLabel}>
              {theme === "dark" ? "Light Mode" : "Dark Mode"}
            </span>
          </button>
          {isAdmin && (
            <div className={styles.statusRow}>
              <span
                className={`${styles.statusDot} ${systemStatus !== "connected" ? styles.offline : ""}`}
              />
              <span>
                Prism {systemStatus === "connected" ? "Connected" : "Offline"}
              </span>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
