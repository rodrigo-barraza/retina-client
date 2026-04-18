import { useRef, useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";
import TooltipComponent from "./TooltipComponent";
import styles from "./MessageCountBadgeComponent.module.css";

/** Duration of the count-up tween in ms. */
const TWEEN_MS = 600;

/** Ease-out cubic — fast start, gentle landing. */
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * MessageCountBadgeComponent — violet-tinted message count pill with optional icon.
 * When the count updates upward, the displayed number tweens (counting animation)
 * from the previous value to the new value, with a rainbow hue-rotate effect
 * on the text while the tween is active.
 *
 * @param {number} count — message count
 * @param {number} [deletedCount=0] — number of deleted messages
 * @param {boolean} [showIcon=true] — show MessageSquare icon
 * @param {string} [className]
 * @param {boolean} [mini]
 */
export default function MessageCountBadgeComponent({
  count,
  deletedCount = 0,
  showIcon = true,
  className = "",
  mini = false,
}) {
  const prevRef = useRef(null);
  const rafRef = useRef(null);
  const [displayCount, setDisplayCount] = useState(count);

  useEffect(() => {
    const from = prevRef.current;
    prevRef.current = count;

    // First mount or same value — nothing to animate
    if (from === null || from === count) return;

    const delta = count - from;
    const start = performance.now();

    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / TWEEN_MS, 1);
      const eased = easeOutCubic(progress);
      setDisplayCount(Math.round(from + delta * eased));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [count]);

  if (count === undefined || count === null) return null;

  // Derive tweening state — avoids synchronous setState in effect
  const tweening = displayCount !== count;
  const suffix = displayCount !== 1 ? "messages" : "message";
  const tooltipLabel = deletedCount > 0
    ? `${count.toLocaleString()} ${suffix} (${deletedCount} deleted)`
    : `${count.toLocaleString()} ${suffix}`;

  return (
    <TooltipComponent label={tooltipLabel} position="top">
      <span
        className={`${styles.badge} ${mini ? styles.mini : ""} ${tweening ? styles.tweening : ""} ${className}`}
      >
        {showIcon && <MessageSquare size={mini ? 8 : 10} />}
        {displayCount.toLocaleString()} {suffix}
        {deletedCount > 0 && (
          <span className={styles.deletedSub}>
            ({deletedCount} deleted)
          </span>
        )}
      </span>
    </TooltipComponent>
  );
}
