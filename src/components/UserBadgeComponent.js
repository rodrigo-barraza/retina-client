import { User } from "lucide-react";
import TooltipComponent from "./TooltipComponent";
import styles from "./UserBadgeComponent.module.css";

/**
 * UserBadgeComponent — amber-colored user/username badge with icon.
 *
 * @param {string} username — username to display
 * @param {string} [className]
 */
export default function UserBadgeComponent({ username, className = "" }) {
  if (!username || username === "unknown") return null;
  return (
    <TooltipComponent label={`User: ${username}`} position="top">
      <span className={`${styles.badge} ${className}`}>
        <User size={10} />
        {username}
      </span>
    </TooltipComponent>
  );
}
