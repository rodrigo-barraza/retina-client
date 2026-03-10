"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
    LayoutDashboard,
    ScrollText,
    MessageSquare,
    Activity,
    Sun,
    Moon,
    Eye,
    ArrowLeft,
    Server,
    DollarSign,
} from "lucide-react";
import { useTheme } from "./ThemeProvider";
import styles from "./AdminSidebar.module.css";

const NAV_ITEMS = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/requests", label: "Requests", icon: ScrollText },
    { href: "/admin/conversations", label: "Conversations", icon: MessageSquare },
    { href: "/admin/pricing", label: "Pricing", icon: DollarSign },
    { href: "/admin/lm-studio", label: "LM Studio", icon: Server },
    { href: "/admin/live", label: "Live Activity", icon: Activity, live: true },
];

export default function AdminSidebar({
    liveCount = 0,
    systemStatus = "connected",
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
                        >
                            <Icon className={styles.navIcon} />
                            <span>{item.label}</span>
                            {item.live && liveCount > 0 && (
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
