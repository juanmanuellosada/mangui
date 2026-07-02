// Service Worker para Mangui — passthrough para assets de Next.js.
// Gestiona notificaciones push, el criterio de instalabilidad PWA y un
// fallback mínimo de "offline en frío" (ver bloque fetch más abajo).
// NO intercepta ni cachea assets de la app (chunks con hash, datos, API) —
// evita bugs con los hashes de Next.js. Solo precachea el shell estático
// necesario para mostrar /offline cuando no hay red y no hay nada cargado.

// Subir este número fuerza que los clientes existentes descarten el cache
// viejo en `activate` (ver más abajo).
const SHELL_CACHE = "mangui-shell-v1"
const OFFLINE_URL = "/offline"
const SHELL_ASSETS = [OFFLINE_URL, "/manifest.json", "/icon-192.png"]

// ---------------------------------------------------------------------------
// Install: precachear el shell mínimo para el fallback offline y activarse
// de inmediato sin esperar a que cierren las pestañas.
// ---------------------------------------------------------------------------
self.addEventListener("install", (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .catch(() => {
        // Si el precache falla (ej. red inestable durante el install), no
        // rompemos el resto del SW (push, sync) por esto.
      })
  )
})

// ---------------------------------------------------------------------------
// Activate: borrar caches de versiones anteriores y tomar control de todos
// los clientes abiertos.
// ---------------------------------------------------------------------------
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== SHELL_CACHE).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  )
})

// ---------------------------------------------------------------------------
// Fetch: red de seguridad conservadora. Solo interviene en navegaciones
// (carga de documento HTML). Estrategia network-first: si la red responde,
// se usa esa respuesta tal cual; si la red falla (offline), se sirve la
// página /offline precacheada. Todo lo demás (chunks de Next, API, datos)
// pasa de largo sin tocar — así no se rompen los hashes de assets.
// ---------------------------------------------------------------------------
self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.mode !== "navigate") return

  event.respondWith(
    fetch(request).catch(() =>
      caches.match(OFFLINE_URL, { cacheName: SHELL_CACHE }).then((cached) => cached || Response.error())
    )
  )
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
