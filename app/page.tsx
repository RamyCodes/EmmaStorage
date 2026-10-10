import Image from "next/image";
import { version } from "@/package.json";
import ActivityForm from "./activity-form";

export default function Home() {
  return (
    <main className="app-shell">
      <header className="brand-header">
        <Image className="brand-logo" src="/images.jpg" width={72} height={72} alt="Emmanuel logo" />
        <div className="brand-name">
          <h1>Emmanuel <span>Egypt</span></h1>
          <p className="brand-subtitle">Storage activity</p>
        </div>
      </header>
      <ActivityForm />
      <footer className="brand-footer">
        <div className="brand-footer-copy">
          <span className="app-version">App version {version}</span>
        </div>
      </footer>
    </main>
  );
}
