import { useRef, useEffect, useState } from "react";
import { Zap } from "lucide-react";
import TooltipComponent from "./TooltipComponent";
import styles from "./RequestCountBadgeComponent.module.css";

/** Duration of the count-up tween in ms. */
const TWEEN_MS = 600;

/** Ease-out cubic — fast start, gentle landing. */
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * RequestCountBadgeComponent — amber-tinted request count pill with optional icon.
 * When the count updates upward, the displayed number tweens (counting animation)
 * from the previous value to the new value, with a rainbow hue-rotate effect
 * on the text while the tween is active.
 *
 * @param {number} count — request count
 * @param {boolean} [showIcon=true] — show Zap icon
 * @param {string} [className]
 * @param {boolean} [mini]
 */
export default function RequestCountBadgeComponent({
  count,
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

  if (!count || count <= 0) return null;

  // Derive tweening state — avoids synchronous setState in effect
  const tweening = displayCount !== count;
  const suffix = displayCount !== 1 ? "requests" : "request";
  const tooltipLabel = `${count.toLocaleString()} API ${suffix}`;

  return (
    <TooltipComponent label={tooltipLabel} position="top">
      <span
        className={`${styles.badge} ${mini ? styles.mini : ""} ${tweening ? styles.tweening : ""} ${className}`}
      >
        {showIcon && <Zap size={mini ? 8 : 10} />}
        {displayCount.toLocaleString()} {suffix}
      </span>
    </TooltipComponent>
  );
}
