import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initializeAppStorageVersion, repairCorruptedAppStorage } from "./lib/storage";

initializeAppStorageVersion();
repairCorruptedAppStorage();

// Register service worker for background Pomodoro notifications.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(<App />);
