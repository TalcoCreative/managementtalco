// Talco PWA Service Worker - Push Notification Handler

// Handle notification clicks
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  
  const data = event.notification.data || {};
  const url = data.url || "/";
  
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Check if there's already an open window/tab
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          if (data.url) {
            client.postMessage({ type: "NOTIFICATION_CLICK", data });
          }
          return;
        }
      }
      // Open a new window if none exists
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});

// Handle push events (for server-sent push)
self.addEventListener("push", (event) => {
  let data = { title: "Talco", body: "You have a new notification" };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data.body = event.data.text();
    }
  }
  
  const options = {
    body: data.body,
    icon: "/pwa-512.png",
    badge: "/pwa-512.png",
    tag: data.tag || "talco-push",
    data: data.data || {},
    requireInteraction: false,
    silent: false,
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || "Talco", options)
  );
});
