"use client";

import { useState, useEffect } from "react";
import { Settings, History } from "lucide-react";
import styles from "./ThreePanelLayout.module.css";

/**
 * Reusable 3-panel layout with animated sidebars and header toggle buttons.
 *
 * Props:
 *   leftPanel      — React node for the left sidebar content (e.g. SettingsPanel)
 *   leftTitle      — Title for the left sidebar header (default: "Settings")
 *   rightPanel     — React node for the right sidebar content (e.g. HistoryPanel)
 *   rightTitle     — Title for the right sidebar header (default: "History")
 *   headerTitle    — Title displayed in the center header
 *   headerMeta     — React node for meta info in the center header (badges, counts)
 *   headerControls — React node for extra controls in the center header (theme toggle, etc.)
 *   children       — Main content area (chat, viewer, etc.)
 */
export default function ThreePanelLayout({
    leftPanel,
    leftTitle = "Settings",
    rightPanel,
    rightTitle = "History",
    headerTitle = "",
    headerMeta = null,
    headerControls = null,
    children,
}) {
    // Start with panels visible (matches SSR), then sync from localStorage after mount
    const [showLeft, setShowLeft] = useState(true);
    const [showRight, setShowRight] = useState(true);
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        const storedLeft = localStorage.getItem("panel_left");
        const storedRight = localStorage.getItem("panel_right");
        const left =
            storedLeft !== null ? storedLeft === "true" : window.innerWidth >= 768;
        const right =
            storedRight !== null
                ? storedRight === "true"
                : window.innerWidth >= 768;
        // eslint-disable-next-line react-compiler/react-compiler
        setShowLeft(left);
        setShowRight(right);
        setHydrated(true);
    }, []);

    const toggleLeft = () => {
        const next = !showLeft;
        setShowLeft(next);
        localStorage.setItem("panel_left", String(next));
        if (next && window.innerWidth < 768) {
            setShowRight(false);
            localStorage.setItem("panel_right", "false");
        }
    };

    const toggleRight = () => {
        const next = !showRight;
        setShowRight(next);
        localStorage.setItem("panel_right", String(next));
        if (next && window.innerWidth < 768) {
            setShowLeft(false);
            localStorage.setItem("panel_left", "false");
        }
    };

    // Suppress the CSS transition on first paint so panels don't animate from open→closed
    const transitionStyle = hydrated ? undefined : { transition: "none" };

    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 768);
        check();
        window.addEventListener("resize", check);
        return () => window.removeEventListener("resize", check);
    }, []);

    return (
        <div className={styles.container}>
            {/* Left Sidebar */}
            <aside
                className={`${styles.leftSidebar} ${!showLeft ? styles.sidebarHidden : ""}`}
                style={transitionStyle}
            >
                <div className={styles.sidebarHeader}>{leftTitle}</div>
                {leftPanel}
            </aside>

            {/* Mobile slit: visible strip behind left sidebar (settings) — appears on right edge */}
            {isMobile && showLeft && (
                <div
                    className={styles.mobileSlit}
                    data-side="left"
                    onClick={toggleLeft}
                />
            )}

            {/* Main Center */}
            <section className={styles.main}>
                <div className={styles.glassHeader}>
                    <button
                        className={styles.headerToggle}
                        onClick={toggleLeft}
                        title={showLeft ? `Hide ${leftTitle.toLowerCase()}` : `Show ${leftTitle.toLowerCase()}`}
                    >
                        <Settings size={16} />
                    </button>
                    <span className={styles.headerTitle}>{headerTitle}</span>
                    {headerMeta}
                    {headerControls}
                    <button
                        className={styles.headerToggle}
                        onClick={toggleRight}
                        title={showRight ? `Hide ${rightTitle.toLowerCase()}` : `Show ${rightTitle.toLowerCase()}`}
                    >
                        <History size={16} />
                    </button>
                </div>
                {children}
            </section>

            {/* Mobile slit: visible strip behind right sidebar (history) — appears on left edge */}
            {isMobile && showRight && (
                <div
                    className={styles.mobileSlit}
                    data-side="right"
                    onClick={toggleRight}
                />
            )}

            {/* Right Sidebar */}
            <aside
                className={`${styles.rightSidebar} ${!showRight ? styles.sidebarHidden : ""}`}
                style={transitionStyle}
            >
                <div className={styles.sidebarHeader}>{rightTitle}</div>
                {rightPanel}
            </aside>
        </div>
    );
}
