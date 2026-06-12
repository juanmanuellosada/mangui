// Service Worker para Mangui — sin caché (passthrough).
// Gestiona notificaciones push y el criterio de instalabilidad PWA.
// No intercepta ni cachea assets — evita bugs con los hashes de Next.js.

// ---------------------------------------------------------------------------
// Install: activarse de inmediato sin esperar a que cierren las pestañas.
// ---------------------------------------------------------------------------
self.addEventListener("install", () => {
  self.skipWaiting()
})

// ---------------------------------------------------------------------------
// Activate: tomar control de todos los clientes abiertos.
// ---------------------------------------------------------------------------
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

// ---------------------------------------------------------------------------
// Push: mostrar la notificación con el payload JSON recibido.
// Payload esperado: { title, body, url, icon }
// ---------------------------------------------------------------------------
self.addEventListener("push", (event) => {
  let title = "Mangui"
  let body = ""
  let url = "/"
  let icon = "/icon-192.png"

  if (event.data) {
    try {
      const data = event.data.json()
      title = data.title || title
      body = data.body || body
      url = data.url || url
      icon = data.icon || icon
    } catch {
      // Si el payload no es JSON válido, usarlo como cuerpo de texto plano.
      body = event.data.text()
    }
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge: "/icon-192.png",
      data: { url },
    })
  )
})

// ---------------------------------------------------------------------------
// Notification click: enfocar una ventana existente o abrir la URL.
// ---------------------------------------------------------------------------
self.addEventListener("notificationclick", (event) => {
  event.notification.close()

  const targetUrl = (event.notification.data && event.notification.data.url) || "/"

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // Si ya hay una ventana abierta, enfocarla.
        for (const client of windowClients) {
          if (client.url === targetUrl && "focus" in client) {
            return client.focus()
          }
        }
        // Si no, abrir una nueva ventana en la URL de destino.
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl)
        }
      })
  )
})

// ---------------------------------------------------------------------------
// Fetch: passthrough — no cachea nada, deja que el navegador resuelva.
// Requerido para que la PWA sea instalable (el navegador exige un fetch handler).
// ---------------------------------------------------------------------------
self.addEventListener("fetch", () => {
  // Sin intercepción intencional.
})

// ---------------------------------------------------------------------------
// Background sync: cuando el navegador detecta que volvió la señal y hay
// una sync pendiente con el tag "mangui-sync", notificar a todos los clientes
// para que drenen la cola de movimientos offline.
// ---------------------------------------------------------------------------
self.addEventListener("sync", (event) => {
  if (event.tag === "mangui-sync") {
    event.waitUntil(
      self.clients.matchAll({ includeUncontrolled: true, type: "window" }).then((cs) => {
        cs.forEach((c) => c.postMessage({ type: "drain-queue" }))
      })
    )
  }
})
