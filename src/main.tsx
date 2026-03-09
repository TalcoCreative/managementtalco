import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register service worker for PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      // Register the main PWA service worker
      const registration = await navigator.serviceWorker.register("/sw.js");
      console.log("SW registered:", registration.scope);
      
      // Handle notification click messages from SW
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
