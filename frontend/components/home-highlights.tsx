import Link from "next/link";
import { BriefcaseBusiness, Calculator } from "lucide-react";
import styles from "./home-highlights.module.css";

export function HomeHighlights() {
  return (
    <nav className={styles.strip} aria-label="Featured services">
      <div className={styles.inner}>
        <Link className={styles.link} href="/car-valuation">
          <Calculator size={17} aria-hidden="true" />
          <span>Free car valuation</span>
        </Link>
        <Link className={styles.link} href="/commercial">
          <BriefcaseBusiness size={17} aria-hidden="true" />
          <span>Corporate cab support</span>
        </Link>
      </div>
    </nav>
  );
}
