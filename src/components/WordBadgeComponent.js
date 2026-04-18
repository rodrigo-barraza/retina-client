import { LetterText } from "lucide-react";
import TooltipComponent from "./TooltipComponent";
import styles from "./WordBadgeComponent.module.css";

/**
 * WordBadgeComponent — displays a word count badge with an icon.
 *
 * @param {number} count — word count
 * @param {string} [className]
 * @param {boolean} [mini]
 */
export default function WordBadgeComponent({
  count,
  className = "",
  mini = false,
}) {
  if (!count || count <= 0) return null;

  const suffix = count !== 1 ? "words" : "word";
  const tooltipLabel = `${count.toLocaleString()} ${suffix}`;

  return (
    <TooltipComponent label={tooltipLabel} position="top">
      <span
        className={`${styles.badge} ${mini ? styles.mini : ""} ${className}`}
      >
        <LetterText size={mini ? 8 : 10} />
        {count.toLocaleString()} {suffix}
      </span>
    </TooltipComponent>
  );
}
