"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  ScrollText,
  MessageSquare,
  Eye,
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
} from "lucide-react";
import { useTheme } from "./ThemeProvider";
import styles from "./NavigationSidebarComponent.module.css";

const USER_NAV_ITEMS = [
  { href: "/", label: "Conversations", icon: MessageSquare, exact: true },
  { href: "/workflows", label: "Workflows", icon: Workflow },
  { href: "/models", label: "Models", icon: Server },
  { href: "/media", label: "Media", icon: ImageIcon },
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
  { href: "/admin/pricing", label: "Usage", icon: DollarSign },
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

  const navItems = mode === "admin" ? ADMIN_NAV_ITEMS : USER_NAV_ITEMS;
  const isAdmin = mode === "admin";

  return (
    <aside className={styles.sidebar}>
      {/* Logo */}
      <div className={styles.logo}>
        <div className={styles.logoIcon}>
          <Eye size={18} />
        </div>
        <div className={styles.logoText}>
          <span className={styles.logoTitle}>Iris</span>
          <span className={styles.logoSubtitle}>
            {isAdmin ? "Admin" : "Retina"}
          </span>
        </div>
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
  );
}
