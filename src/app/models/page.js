import NavigationSidebarComponent from "../../components/NavigationSidebarComponent";
import ModelsPageComponent from "../../components/ModelsPageComponent";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default function UserModelsPage() {
  return (
    <div className="page-wrapper">
      <NavigationSidebarComponent mode="user" />
      <div className={styles.page}>
        <ModelsPageComponent mode="user" />
      </div>
    </div>
  );
}
