"use client";

import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import PrismService from "../services/PrismService.js";
import {
  LayoutDashboard,
  ScrollText,
  MessageSquare,
  ArrowLeft,
  Server,
  GitBranch,
  Sun,
  Moon,
  Image as ImageIcon,
  Layers,
  Type,
  Workflow,
  Settings,
  ChevronsLeft,
  Menu,
  X,
  FolderOpen,
  FlaskConical,
  Target,
  Bot,
  MemoryStick,
  Wrench,
  BarChart3,
  AlertCircle,
} from "lucide-react";
import { useTheme } from "./ThemeProvider";
import SpinningCatComponent from "./SpinningCatComponent";
import TooltipComponent from "./TooltipComponent";
import styles from "./NavigationSidebarComponent.module.css";
import { LS_PANEL_NAV } from "../constants";

import RainbowCanvasComponent from "./RainbowCanvasComponent";
import SoundService from "@/services/SoundService";

function RainbowCanvas({ turbo = false, greyscale = false }) {
  return (
    <RainbowCanvasComponent turbo={turbo} greyscale={greyscale} className={styles.rainbowCanvas} />
  );
}

const USER_NAV_ITEMS = [
  { href: "/coding-agent", label: "Coding Agent", icon: Bot },
  {
    href: "/",
    label: "Conversations",
    icon: MessageSquare,
    exact: true,
    alsoMatches: ["/conversations"],
  },
  { href: "/models", label: "Models", icon: Server },
  { href: "/media", label: "Media", icon: ImageIcon },
  { href: "/text", label: "Text", icon: Type },
  { href: "/settings", label: "Settings", icon: Settings },
];

const USER_EXPERIMENT_ITEMS = [
  { href: "/benchmarks", label: "Benchmarks", icon: Target },
  { href: "/vram-benchmark", label: "VRAM Bench", icon: MemoryStick },
  { href: "/synthesis", label: "Synthesis", icon: FlaskConical },
  { href: "/workflows", label: "Workflows", icon: Workflow },
];

const ADMIN_NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/requests", label: "Requests", icon: ScrollText, showBadge: "requests" },
  { href: "/admin/tool-requests", label: "Tool Requests", icon: Wrench },
  { href: "/admin/tool-calls", label: "Tool Calls", icon: BarChart3 },
  {
    href: "/admin/conversations",
    label: "Conversations",
    icon: MessageSquare,
    showBadge: "conversations",
  },
  { href: "/admin/traces", label: "Traces", icon: FolderOpen, showBadge: "traces" },
  { href: "/admin/agent-sessions", label: "Agent Sessions", icon: Bot },
  { href: "/admin/providers", label: "Providers", icon: Layers },
  { href: "/admin/media", label: "Media", icon: ImageIcon, showBadge: "media" },
  { href: "/admin/text", label: "Text", icon: Type, showBadge: "text" },
  { href: "/admin/models", label: "Models", icon: Server },
];

const ADMIN_EXPERIMENT_ITEMS = [
  { href: "/admin/synthesis", label: "Synthesis", icon: FlaskConical },
  { href: "/admin/workflows", label: "Workflows", icon: GitBranch },
];

export default function NavigationSidebarComponent({
  mode = "user",
  liveCount = 0,
  tracesCount = 0,
  requestsCount = 0,
  mediaCount = 0,
  textCount = 0,
  systemStatus = "connected",
  isGenerating = false,
  activeApiCount = 0,
  onNavClick,
}) {
  const badgeCounts = {
    conversations: liveCount,
    traces: tracesCount,
    requests: requestsCount,
    media: mediaCount,
    text: textCount,
  };
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [showNav, setShowNav] = useState(true);
  const [navReady, setNavReady] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isLocal, setIsLocal] = useState(false);
  const [memoryConfigured, setMemoryConfigured] = useState(true);

  // Fetch memory settings to determine if action is needed on /settings
  useEffect(() => {
    if (mode !== "user") return;
    PrismService.getSettings()
      .then((s) => {
        const mem = s?.memory || {};
        setMemoryConfigured(
          Boolean(mem.extractionProvider && mem.extractionModel &&
                  mem.consolidationProvider && mem.consolidationModel &&
                  mem.embeddingProvider && mem.embeddingModel),
        );
      })
      .catch(() => {});
  }, [mode]);

  useEffect(() => {
    // Resolve on client only — prevents SSR hydration flash of admin link
    setIsLocal(!window.location.hostname.endsWith(".com"));
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(LS_PANEL_NAV);
    if (stored !== null) setShowNav(stored === "true");
    // Enable transitions after first paint
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setNavReady(true));
    });
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 1200);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const toggleNav = useCallback(() => {
    setShowNav((prev) => {
      const next = !prev;
      localStorage.setItem(LS_PANEL_NAV, String(next));
      return next;
    });
  }, []);

  // ── Bouncing mini cats for concurrent API calls ────────────────
  // Lifecycle: active → windingDown → idle → fading → removed
  const bannerRef = useRef(null);
  const catStateRef = useRef(new Map());
  const catElsRef = useRef(new Map());
  const isGenRef = useRef(isGenerating);
  const prevIsGenRef = useRef(false);
  const miniCatsRef = useRef([]);
  const [miniCats, setMiniCats] = useState([]);

  // Mirror props into refs for RAF access
  useEffect(() => { isGenRef.current = isGenerating; }, [isGenerating]);
  useEffect(() => { miniCatsRef.current = miniCats; }, [miniCats]);

  // Add cats when workers spawn, retire cats when workers finish
  useEffect(() => {
    const needed = Math.max(0, (activeApiCount || 0) - 1);
    setMiniCats((prev) => {
      const activeCount = prev.filter((c) => !c.retired).length;
      if (needed === activeCount) return prev;

      if (needed < activeCount) {
        // Retire excess active cats (last ones first)
        let toRetire = activeCount - needed;
        const next = [...prev];
        for (let i = next.length - 1; i >= 0 && toRetire > 0; i--) {
          if (!next[i].retired) {
            next[i] = { ...next[i], retired: true };
            toRetire--;
          }
        }
        return next;
      }

      // Spawn new cats
      const next = [...prev];
      const toAdd = needed - activeCount;
      for (let j = 0; j < toAdd; j++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 30 + Math.random() * 40;
        next.push({
          id: crypto.randomUUID(),
          size: 45 + Math.floor(Math.random() * 22),
          initVx: Math.cos(angle) * speed,
          initVy: Math.sin(angle) * speed,
          retired: false,
        });
      }
      return next;
    });
  }, [activeApiCount]);

  // Always-on RAF: movement, bouncing, FX, lifecycle phases
  useEffect(() => {
    let lastTime = 0;
    let rafId;

    const tick = (now) => {
      const cats = miniCatsRef.current;
      if (cats.length === 0) {
        lastTime = 0;
        prevIsGenRef.current = isGenRef.current;
        rafId = requestAnimationFrame(tick);
        return;
      }

      if (!lastTime) { lastTime = now; rafId = requestAnimationFrame(tick); return; }
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      const banner = bannerRef.current;
      if (!banner) { rafId = requestAnimationFrame(tick); return; }
      const bw = banner.offsetWidth;
      const bh = banner.offsetHeight;
      const isGen = isGenRef.current;

      // Detect primary cat stop: isGenerating true → false → fade ALL cats
      if (prevIsGenRef.current && !isGen) {
        for (const [, p] of catStateRef.current) {
          if (p.phase !== "fading") {
            p.phase = "fading";
            p.fadeStart = now;
          }
        }
      }
      prevIsGenRef.current = isGen;

      const toRemove = [];

      for (const cat of cats) {
        let p = catStateRef.current.get(cat.id);
        if (!p) {
          p = {
            x: bw / 2, y: bh / 2,
            vx: cat.initVx, vy: cat.initVy,
            accelTime: 0,
            phase: "active",
            fadeStart: null,
          };
          catStateRef.current.set(cat.id, p);
        }

        const el = catElsRef.current.get(cat.id);
        if (!el) continue;

        // Phase transition: worker finished → start winding down
        if (cat.retired && p.phase === "active") {
          p.phase = "windingDown";
        }

        // Bounce helper (specular reflection)
        const hs = cat.size / 2;
        const bounce = () => {
          if (p.x < hs) { p.x = hs; p.vx = Math.abs(p.vx); }
          else if (p.x > bw - hs) { p.x = bw - hs; p.vx = -Math.abs(p.vx); }
          if (p.y < hs) { p.y = hs; p.vy = Math.abs(p.vy); }
          else if (p.y > bh - hs) { p.y = bh - hs; p.vy = -Math.abs(p.vy); }
        };

        // FX helper (SpinningCat-style quadratic ramp)
        const computeFx = () => {
          const sm = 0.2 + 0.08 * p.accelTime * p.accelTime;
          const t = Math.min((sm - 0.2) / 4.8, 1);
          return {
            scale: 1 + t * 0.5,
            brightness: 1 + t * 2,
            glowR: t * 12,
            glowO: t * 0.9,
          };
        };

        if (p.phase === "active") {
          // ─── Active: bouncing, FX ramping up ───
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.accelTime += dt;
          bounce();

          const fx = computeFx();
          el.style.left = `${p.x}px`;
          el.style.top = `${p.y}px`;
          el.style.transform = `translate(-50%, -50%) scale(${fx.scale})`;
          el.style.filter = `brightness(${fx.brightness}) drop-shadow(0 0 ${fx.glowR}px rgba(255,255,255,${fx.glowO}))`;
          el.style.opacity = "0.85";
          if (!el.src.endsWith("cat-spinning.gif")) el.src = "/cat-spinning.gif";

        } else if (p.phase === "windingDown") {
          // ─── Winding down: decelerating, FX reversing ───
          const smoothing = Math.pow(0.97, dt * 60);
          p.vx *= smoothing;
          p.vy *= smoothing;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          bounce();

          // Reverse FX (wind down twice as fast as ramp up)
          p.accelTime = Math.max(0, p.accelTime - dt * 2);
          const fx = computeFx();
          el.style.left = `${p.x}px`;
          el.style.top = `${p.y}px`;
          el.style.transform = `translate(-50%, -50%) scale(${fx.scale})`;
          el.style.filter = `brightness(${fx.brightness}) drop-shadow(0 0 ${fx.glowR}px rgba(255,255,255,${fx.glowO}))`;

          // Stopped → transition to idle, switch to static cat
          if (Math.sqrt(p.vx * p.vx + p.vy * p.vy) < 2) {
            p.vx = 0;
            p.vy = 0;
            p.phase = "idle";
            el.src = "/cat.gif";
          }

        } else if (p.phase === "idle") {
          // ─── Idle: sitting still, static sprite, waiting ───
          el.style.transform = "translate(-50%, -50%)";
          el.style.filter = "drop-shadow(0 1px 4px rgba(0,0,0,0.45))";
          el.style.opacity = "0.85";

        } else if (p.phase === "fading") {
          // ─── Fading: decelerating + fade/shrink over 3 seconds ───
          const smoothing = Math.pow(0.95, dt * 60);
          p.vx *= smoothing;
          p.vy *= smoothing;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          bounce();

          // Wind down remaining FX
          p.accelTime = Math.max(0, p.accelTime - dt * 3);
          const fx = computeFx();

          const elapsed = (now - p.fadeStart) / 1000;
          const progress = Math.min(elapsed / 3, 1);
          const opacity = 0.85 * (1 - progress);
          const scale = 1 - progress * 0.3;

          el.style.left = `${p.x}px`;
          el.style.top = `${p.y}px`;
          el.style.transform = `translate(-50%, -50%) scale(${scale})`;
          el.style.filter = `brightness(${fx.brightness}) drop-shadow(0 0 ${fx.glowR}px rgba(255,255,255,${fx.glowO}))`;
          el.style.opacity = `${opacity}`;

          // Switch to static cat once slowed enough
          if (Math.sqrt(p.vx * p.vx + p.vy * p.vy) < 2 && el.src.endsWith("cat-spinning.gif")) {
            el.src = "/cat.gif";
          }

          if (progress >= 1) toRemove.push(cat.id);
        }
      }

      // Clean up fully faded cats
      if (toRemove.length > 0) {
        const removeSet = new Set(toRemove);
        for (const id of removeSet) {
          catStateRef.current.delete(id);
          catElsRef.current.delete(id);
        }
        setMiniCats((prev) => prev.filter((c) => !removeSet.has(c.id)));
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const navItems = mode === "admin" ? ADMIN_NAV_ITEMS : USER_NAV_ITEMS;
  const experimentItems = mode === "admin" ? ADMIN_EXPERIMENT_ITEMS : USER_EXPERIMENT_ITEMS;
  const isAdmin = mode === "admin";

  /* ── Mobile: render floating hamburger + compact popover menu ── */
  if (isMobile) {
    return (
      <>
        {/* Floating triangle trigger */}
        <button
          className={styles.mobileHamburger}
          onClick={() => setMobileOpen((v) => !v)}
          title={mobileOpen ? "Close navigation" : "Open navigation"}
        >
          {/* Spinning triangle with rainbow edge */}
          <span className={styles.triangleSpin}>
            <span className={styles.triangleOuter}>
              <RainbowCanvas turbo={isGenerating} greyscale={!isGenerating} />
            </span>
            <span className={styles.triangleInner} />
          </span>
          {/* Icon stays centered, doesn't spin */}
          <span className={styles.triangleIcon}>
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </span>
        </button>

        {/* Popover card */}
        {mobileOpen && (
          <>
            <div
              className={styles.mobileBackdrop}
              onClick={() => setMobileOpen(false)}
            />
            <div className={styles.mobilePopover}>
              {/* Rainbow strip */}
              <div className={styles.rainbowStrip}>
                <RainbowCanvas turbo={isGenerating} greyscale={!isGenerating} />
                <SpinningCatComponent animate={isGenerating} />
              </div>

              {/* Navigation links */}
              <nav className={styles.mobilePopoverNav}>
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    (item.exact
                      ? pathname === item.href
                      : pathname.startsWith(item.href)) ||
                    item.alsoMatches?.some((p) =>
                      pathname.startsWith(p)
                    );

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`${styles.navLink} ${isActive ? styles.active : ""}`}
                      onMouseEnter={(e) => SoundService.playHover({ event: e })}
                      onClick={(e) => {
                        SoundService.playClick({ event: e });
                        onNavClick?.(item.href);
                        setMobileOpen(false);
                      }}
                    >
                      <Icon className={styles.navIcon} />
                      <span className={styles.navLabel}>{item.label}</span>
                      {item.href === "/settings" && !memoryConfigured && (
                        <span className={styles.attentionDot} title="Memory models need to be configured">
                          <AlertCircle size={13} />
                        </span>
                      )}
                      {item.showBadge && badgeCounts[item.showBadge] > 0 && (
                        <span className={`${styles.badge} ${styles.live}`}>
                          {badgeCounts[item.showBadge]}
                        </span>
                      )}
                    </Link>
                  );
                })}

                {/* Experiments divider (mobile) */}
                {experimentItems.length > 0 && (
                  <>
                    <div className={styles.navDivider}>
                      <span>Experiments</span>
                    </div>
                    {experimentItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = pathname.startsWith(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`${styles.navLink} ${isActive ? styles.active : ""}`}
                          onMouseEnter={(e) => SoundService.playHover({ event: e })}
                          onClick={(e) => {
                            SoundService.playClick({ event: e });
                            onNavClick?.(item.href);
                            setMobileOpen(false);
                          }}
                        >
                          <Icon className={styles.navIcon} />
                          <span className={styles.navLabel}>{item.label}</span>
                        </Link>
                      );
                    })}
                  </>
                )}
              </nav>

              {/* Footer actions */}
              <div className={styles.mobilePopoverFooter}>
                {isAdmin ? (
                  <Link
                    href="/"
                    className={styles.navLink}
                    onClick={() => setMobileOpen(false)}
                  >
                    <ArrowLeft className={styles.navIcon} />
                    <span className={styles.navLabel}>Back to Retina</span>
                  </Link>
                ) : isLocal ? (
                  <Link
                    href="/admin"
                    className={styles.navLink}
                    onClick={() => setMobileOpen(false)}
                  >
                    <Settings className={styles.navIcon} />
                    <span className={styles.navLabel}>Admin</span>
                  </Link>
                ) : null}
                <button
                  className={`${styles.navLink} ${styles.themeToggle}`}
                  onClick={toggleTheme}
                >
                  {theme === "dark" ? (
                    <Sun className={styles.navIcon} />
                  ) : (
                    <Moon className={styles.navIcon} />
                  )}
                  <span className={styles.navLabel}>
                    {theme === "dark" ? "Light Mode" : "Dark Mode"}
                  </span>
                </button>
              </div>
            </div>
          </>
        )}
      </>
    );
  }

  /* ── Desktop: standard collapsible sidebar ── */

  return (
    <div className={`${styles.wrapper} ${!showNav ? styles.collapsed : ""} ${!navReady ? styles.noTransition : ""}`}>

      {/* Expanded sidebar */}
      <aside className={styles.sidebar}>
        {/* Rainbow logo banner */}
        <div className={styles.logoBanner} ref={bannerRef}>
          <RainbowCanvas turbo={isGenerating} greyscale={!isGenerating} />
          {miniCats.map((cat) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={cat.id}
              ref={(el) => { if (el) catElsRef.current.set(cat.id, el); else catElsRef.current.delete(cat.id); }}
              src="/cat-spinning.gif"
              alt=""
              className={styles.miniCat}
              style={{ width: `${cat.size}px`, height: `${cat.size}px` }}
            />
          ))}
          <SpinningCatComponent animate={isGenerating} />
          <button
            className={styles.collapseBtn}
            onClick={toggleNav}
            title="Toggle sidebar"
          >
            <ChevronsLeft size={14} />
          </button>
        </div>

        {/* Navigation */}
        <nav className={styles.nav}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              (item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href)) ||
              item.alsoMatches?.some((p) =>
                pathname.startsWith(p)
              );

            const link = (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navLink} ${isActive ? styles.active : ""}`}
                onMouseEnter={(e) => SoundService.playHover({ event: e })}
                onClick={(e) => { SoundService.playClick({ event: e }); onNavClick?.(item.href); }}
              >
                <Icon className={styles.navIcon} />
                <span className={styles.navLabel}>{item.label}</span>
                {item.href === "/settings" && !memoryConfigured && (
                  <span className={styles.attentionDot} title="Memory models need to be configured">
                    <AlertCircle size={13} />
                  </span>
                )}
                {item.showBadge && badgeCounts[item.showBadge] > 0 && (
                  <span className={`${styles.badge} ${styles.live}`}>
                    {badgeCounts[item.showBadge]}
                  </span>
                )}
              </Link>
            );

            return (
              <TooltipComponent key={item.href} label={item.label} position="right" delay={200} disabled={showNav} className={styles.tooltipFill}>
                {link}
              </TooltipComponent>
            );
          })}

          {/* Experiments divider (desktop) */}
          {experimentItems.length > 0 && (
            <>
              <div className={styles.navDivider}>
                <span>Experiments</span>
              </div>
              {experimentItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname.startsWith(item.href);
                const link = (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`${styles.navLink} ${isActive ? styles.active : ""}`}
                    onMouseEnter={(e) => SoundService.playHover({ event: e })}
                    onClick={(e) => { SoundService.playClick({ event: e }); onNavClick?.(item.href); }}
                  >
                    <Icon className={styles.navIcon} />
                    <span className={styles.navLabel}>{item.label}</span>
                  </Link>
                );

                return (
                  <TooltipComponent key={item.href} label={item.label} position="right" delay={200} disabled={showNav} className={styles.tooltipFill}>
                    {link}
                  </TooltipComponent>
                );
              })}
            </>
          )}
        </nav>

        {/* Footer */}
        <div className={styles.footer}>
          {isAdmin ? (
            <TooltipComponent label="Back to Retina" position="right" delay={200} disabled={showNav} className={styles.tooltipFill}>
              <Link href="/" className={styles.navLink} onMouseEnter={(e) => SoundService.playHover({ event: e })} onClick={(e) => SoundService.playClick({ event: e })}>
                <ArrowLeft className={styles.navIcon} />
                <span className={styles.navLabel}>Back to Retina</span>
              </Link>
            </TooltipComponent>
          ) : isLocal ? (
            <TooltipComponent label="Admin" position="right" delay={200} disabled={showNav} className={styles.tooltipFill}>
              <Link href="/admin" className={styles.navLink} onMouseEnter={(e) => SoundService.playHover({ event: e })} onClick={(e) => SoundService.playClick({ event: e })}>
                <Settings className={styles.navIcon} />
                <span className={styles.navLabel}>Admin</span>
              </Link>
            </TooltipComponent>
          ) : null}
          <TooltipComponent label={theme === "dark" ? "Light Mode" : "Dark Mode"} position="right" delay={200} disabled={showNav} className={styles.tooltipFill}>
            <button
              className={`${styles.navLink} ${styles.themeToggle}`}
              onClick={toggleTheme}
            >
              {theme === "dark" ? (
                <Sun className={styles.navIcon} />
              ) : (
                <Moon className={styles.navIcon} />
              )}
              <span className={styles.navLabel}>
                {theme === "dark" ? "Light Mode" : "Dark Mode"}
              </span>
            </button>
          </TooltipComponent>
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
