import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

async function unregisterServiceWorkersAndClearCaches() {
  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }

  if ("caches" in window) {
    const cacheKeys = await caches.keys();
    await Promise.all(cacheKeys.map((key) => caches.delete(key)));
  }
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      if (isPreviewHost) {
        await unregisterServiceWorkersAndClearCaches();
        console.log("Preview mode: service worker disabled and caches cleared");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      console.log("SW registered:", registration.scope);

      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data?.type === "NOTIFICATION_CLICK") {
          const url = event.data.data?.url;
          if (url) {
            window.location.href = url;
          }
        }
      });
    } catch (err) {
      console.log("SW registration failed:", err);
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
