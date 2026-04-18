import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const APP_RUNTIME_VERSION = "2026-04-18-location-fix-v2";

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

async function ensureFreshRuntimeVersion() {
  try {
    const currentVersion = window.localStorage.getItem("__talco_runtime_version");
    if (currentVersion === APP_RUNTIME_VERSION) return;

    await unregisterServiceWorkersAndClearCaches();
    window.localStorage.setItem("__talco_runtime_version", APP_RUNTIME_VERSION);
  } catch (err) {
    console.log("Runtime version refresh skipped:", err);
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

      await ensureFreshRuntimeVersion();

      const registration = await navigator.serviceWorker.register("/sw.js");
      await registration.update();

      let hasReloaded = false;
      const reloadWithFreshBundle = () => {
        if (hasReloaded) return;
        hasReloaded = true;
        window.location.reload();
      };

      navigator.serviceWorker.addEventListener("controllerchange", reloadWithFreshBundle);

      if (registration.waiting) {
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
      }

      registration.addEventListener("updatefound", () => {
        const installingWorker = registration.installing;
        if (!installingWorker) return;

        installingWorker.addEventListener("statechange", () => {
          if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
            installingWorker.postMessage({ type: "SKIP_WAITING" });
          }
        });
      });

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
