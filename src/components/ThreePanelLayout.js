"use client";

import { useState, useEffect, useCallback } from "react";
import { PanelLeftClose, PanelLeft, PanelRightClose, PanelRight } from "lucide-react";
import styles from "./ThreePanelLayout.module.css";

/**
 * Reusable 3-panel layout with a full-width header spanning all panels.
 * The header sits above the sidebars, matching the workflow page pattern.
 *
 * Props:
 *   leftPanel      — React node for the left sidebar content (e.g. SettingsPanel)
 *   leftTitle      — Title for the left sidebar (default: "Settings")
 *   rightPanel     — React node for the right sidebar content (e.g. HistoryPanel)
 *   rightTitle     — Title for the right sidebar (default: "History")
 *   headerTitle    — Title displayed in the header
 *   headerMeta     — React node for meta info in the header (badges, counts)
 *   headerControls — React node for extra controls in the header (theme toggle, etc.)
 *   children       — Main content area (chat, viewer, etc.)
 */
export default function ThreePanelLayout({
    navSidebar = null,
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
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const mobile = window.innerWidth < 768;
        if (mobile) {
            // On mobile, always start with panels closed
            setShowLeft(false);
            setShowRight(false);
        } else {
            // On desktop, restore from localStorage (default open)
            const storedLeft = localStorage.getItem("panel_left");
            const storedRight = localStorage.getItem("panel_right");
            setShowLeft(storedLeft !== null ? storedLeft === "true" : true);
            setShowRight(storedRight !== null ? storedRight === "true" : true);
        }
        // eslint-disable-next-line react-compiler/react-compiler
        setHydrated(true);
    }, []);

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 768);
        check();
        window.addEventListener("resize", check);
        return () => window.removeEventListener("resize", check);
    }, []);

    const toggleLeft = useCallback(() => {
        setShowLeft((prev) => {
            const next = !prev;
            localStorage.setItem("panel_left", String(next));
            if (next && window.innerWidth < 768) {
                setShowRight(false);
                localStorage.setItem("panel_right", "false");
            }
            return next;
        });
    }, []);

    const toggleRight = useCallback(() => {
        setShowRight((prev) => {
            const next = !prev;
            localStorage.setItem("panel_right", String(next));
            if (next && window.innerWidth < 768) {
                setShowLeft(false);
                localStorage.setItem("panel_left", "false");
            }
            return next;
        });
    }, []);


    /* ── Mobile: auto-close sidebar when a [data-panel-close] element is clicked ── */
    const handleSidebarClick = useCallback(
        (closeFn) => (e) => {
            if (!isMobile) return;
            if (e.target.closest("[data-panel-close]")) {
                closeFn();
            }
        },
        [isMobile],
    );

    // Suppress the CSS transition on first paint so panels don't animate from open→closed
    const transitionStyle = hydrated ? undefined : { transition: "none" };

    return (
        <div className={styles.container}>
            {navSidebar}
            <div className={styles.page}>
                {/* Full-width header */}
                <header className={styles.glassHeader}>
                    <button
                        className={styles.headerToggle}
                        onClick={toggleLeft}
                        title={showLeft ? `Hide ${(leftTitle || "panel").toLowerCase()}` : `Show ${(leftTitle || "panel").toLowerCase()}`}
                    >
                        {showLeft ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
                    </button>
                    <span className={styles.headerTitle}>{headerTitle}</span>
                    {!isMobile && headerMeta}
                    {headerControls}
                    {rightPanel && (
                        <button
                            className={styles.headerToggle}
                            onClick={toggleRight}
                            title={showRight ? `Hide ${rightTitle.toLowerCase()}` : `Show ${rightTitle.toLowerCase()}`}
                        >
                            {showRight ? <PanelRightClose size={16} /> : <PanelRight size={16} />}
                        </button>
                    )}
                </header>
                {/* Mobile: meta info row below the header */}
                {isMobile && headerMeta && (
                    <div className={styles.mobileMetaBar}>
                        {headerMeta}
                    </div>
                )}

                {/* Body: sidebars + main content */}
                <div className={styles.body}>
                    {/* Left Sidebar */}
                    <aside
                        className={`${styles.leftSidebar} ${!showLeft ? styles.sidebarHidden : ""}`}
                        style={transitionStyle}
                        onClick={handleSidebarClick(toggleLeft)}
                    >
                        {leftTitle && <div className={styles.sidebarHeader}>{leftTitle}</div>}
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
                        {children}
                    </section>

                    {/* Mobile slit: visible strip behind right sidebar (history) — appears on left edge */}
                    {rightPanel && isMobile && showRight && (
                        <div
                            className={styles.mobileSlit}
                            data-side="right"
                            onClick={toggleRight}
                        />
                    )}

                    {/* Right Sidebar */}
                    {rightPanel && (
                        <aside
                            className={`${styles.rightSidebar} ${!showRight ? styles.sidebarHidden : ""}`}
                            style={transitionStyle}
                            onClick={handleSidebarClick(toggleRight)}
                        >
                            <div className={styles.sidebarHeader}>{rightTitle}</div>
                            {rightPanel}
                        </aside>
                    )}
                </div>
            </div>
        </div>
    );
}
