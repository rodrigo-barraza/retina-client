"use client";

import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
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
  Menu,
  X,
} from "lucide-react";
import { useTheme } from "./ThemeProvider";
import SpinningCatComponent from "./SpinningCatComponent";
import styles from "./NavigationSidebarComponent.module.css";
import { LS_PANEL_NAV } from "../constants";

import RainbowCanvasComponent from "./RainbowCanvasComponent";

function RainbowCanvas({ turbo = false }) {
  return (
    <RainbowCanvasComponent turbo={turbo} className={styles.rainbowCanvas} />
  );
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
  isGenerating = false,
  onNavClick,
}) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [showNav, setShowNav] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(LS_PANEL_NAV);
    if (stored !== null) setShowNav(stored === "true");
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

  const navItems = mode === "admin" ? ADMIN_NAV_ITEMS : USER_NAV_ITEMS;
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
              <RainbowCanvas turbo={isGenerating} />
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
                <RainbowCanvas turbo={isGenerating} />
                <SpinningCatComponent animate={isGenerating} />
              </div>

              {/* Navigation links */}
              <nav className={styles.mobilePopoverNav}>
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
                      onClick={() => {
                        onNavClick?.(item.href);
                        setMobileOpen(false);
                      }}
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
                ) : (
                  <Link
                    href="/admin"
                    className={styles.navLink}
                    onClick={() => setMobileOpen(false)}
                  >
                    <Settings className={styles.navIcon} />
                    <span className={styles.navLabel}>Admin</span>
                  </Link>
                )}
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
          <RainbowCanvas turbo={isGenerating} />
          <SpinningCatComponent animate={isGenerating} />
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
