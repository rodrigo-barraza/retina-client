import { FolderKanban } from "lucide-react";
import styles from "./ProjectBadgeComponent.module.css";

/**
 * ProjectBadgeComponent — cyan-colored project badge with icon.
 *
 * @param {string} project — project name to display
 * @param {string} [className]
 */
export default function ProjectBadgeComponent({ project, className = "" }) {
  if (!project) return null;
  return (
    <span className={`${styles.badge} ${className}`}>
      <FolderKanban size={10} />
      {project}
    </span>
  );
}
