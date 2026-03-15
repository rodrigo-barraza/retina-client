"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
    LayoutDashboard,
    ScrollText,
    MessageSquare,
    Sun,
    Moon,
    Eye,
    ArrowLeft,
    Server,
    DollarSign,
    GitBranch,
} from "lucide-react";
import { useTheme } from "./ThemeProvider";
import styles from "./AdminSidebar.module.css";

const NAV_ITEMS = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/requests", label: "Requests", icon: ScrollText },
    { href: "/admin/conversations", label: "View Conversations", icon: MessageSquare, showBadge: true },
    { href: "/admin/workflows", label: "View Workflows", icon: GitBranch },
    { href: "/admin/pricing", label: "Usage", icon: DollarSign },
    { href: "/admin/models", label: "Models", icon: Server },
];

export default function AdminSidebar({
    liveCount = 0,
    systemStatus = "connected",
    onNavClick,
}) {
    const pathname = usePathname();
    const { theme, toggleTheme } = useTheme();

    return (
        <aside className={styles.sidebar}>
            <div className={styles.logo}>
                <div className={styles.logoIcon}>
                    <Eye size={20} />
                </div>
                <div className={styles.logoText}>
                    <span className={styles.logoTitle}>Iris</span>
                    <span className={styles.logoSubtitle}>Prism Admin</span>
                </div>
            </div>

            <nav className={styles.nav}>
                {NAV_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const isActive =
                        item.href === "/admin"
                            ? pathname === "/admin"
                            : pathname.startsWith(item.href);

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`${styles.navLink} ${isActive ? styles.active : ""}`}
                            onClick={() => onNavClick?.(item.href)}
                        >
                            <Icon className={styles.navIcon} />
                            <span>{item.label}</span>
                            {item.showBadge && liveCount > 0 && (
                                <span className={`${styles.badge} ${styles.live}`}>
                                    {liveCount}
                                </span>
                            )}
                        </Link>
                    );
                })}
            </nav>

            <div className={styles.footer}>
                <Link href="/" className={styles.navLink}>
                    <ArrowLeft className={styles.navIcon} />
                    <span>Back to Retina</span>
                </Link>
                <button className={styles.navLink} onClick={toggleTheme}>
                    {theme === "dark" ? (
                        <Sun className={styles.navIcon} />
                    ) : (
                        <Moon className={styles.navIcon} />
                    )}
                    <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
                </button>
                <div className={styles.statusRow}>
                    <span
                        className={`${styles.statusDot} ${systemStatus !== "connected" ? styles.offline : ""}`}
                    />
                    <span>
                        Prism {systemStatus === "connected" ? "Connected" : "Offline"}
                    </span>
                </div>
            </div>
        </aside>
    );
}
