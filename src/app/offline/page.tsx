import Link from "next/link"
import { WifiOff, CheckCircle2, XCircle } from "lucide-react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Sin conexión",
}

// This page is cached by the service worker as the offline fallback, and is
// served WITHOUT Next's hashed CSS chunks (deliberately, to keep the
// fallback small and always-available). Every style here must therefore be
// inline or embedded in this file — no Tailwind classes, no CSS custom
// properties defined elsewhere.
const colorVars = `
  :root {
    --offline-bg: #FAFAF9;
    --offline-fg: oklch(0.18 0.02 145);
    --offline-muted: oklch(0.52 0.04 145);
    --offline-primary: oklch(0.748 0.219 131.7);
    --offline-primary-fg: oklch(0.1 0.04 145);
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --offline-bg: oklch(0.14 0.025 185);
      --offline-fg: oklch(0.96 0.01 145);
      --offline-muted: oklch(0.65 0.04 145);
      --offline-primary: oklch(0.78 0.22 131.7);
      --offline-primary-fg: oklch(0.1 0.04 145);
    }
  }
  .offline-retry-link {
    transition: opacity 150ms, transform 150ms;
  }
  .offline-retry-link:hover {
    opacity: 0.9;
  }
  .offline-retry-link:active {
    transform: scale(0.97);
  }
  .offline-retry-link:focus-visible {
    outline: 2px solid var(--offline-primary);
    outline-offset: 2px;
  }
`

const availableOffline = [
  "Ver datos ya cargados",
  "Navegar entre secciones visitadas",
  "Revisar tus cuentas y saldos guardados",
  "Cargar movimientos (se sincronizan al volver la señal)",
]

const requiresConnection = ["Refrescar cotizaciones del dólar", "Sincronizar con el servidor"]

export default function OfflinePage() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--offline-bg)",
        color: "var(--offline-fg)",
        padding: "48px 24px",
        textAlign: "center",
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      }}
    >
      <style>{colorVars}</style>

      {/* Brand mark */}
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 24,
          background: "var(--offline-primary)",
        }}
      >
        <WifiOff size={36} color="#fff" strokeWidth={2} />
      </div>

      <h1
        style={{
          fontSize: 30,
          lineHeight: "36px",
          fontWeight: 700,
          letterSpacing: "-0.025em",
          marginBottom: 8,
        }}
      >
        Estás sin conexión
      </h1>
      <p
        style={{
          color: "var(--offline-muted)",
          maxWidth: "36ch",
          lineHeight: 1.625,
          marginBottom: 40,
        }}
      >
        No pudimos conectarnos a internet. Tus datos ya cargados siguen disponibles.
      </p>

      {/* What works offline */}
      <div
        style={{
          width: "100%",
          maxWidth: 384,
          textAlign: "left",
          marginBottom: 40,
        }}
      >
        <p
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--offline-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: 8,
          }}
        >
          Disponible sin conexión
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {availableOffline.map((item) => (
            <div key={item} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <CheckCircle2
                size={16}
                color="var(--offline-primary)"
                style={{ flexShrink: 0 }}
              />
              <span style={{ fontSize: 14 }}>{item}</span>
            </div>
          ))}
        </div>

        <p
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--offline-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginTop: 16,
            marginBottom: 8,
          }}
        >
          Requiere conexión
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {requiresConnection.map((item) => (
            <div key={item} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <XCircle size={16} color="var(--offline-muted)" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 14, color: "var(--offline-muted)" }}>{item}</span>
            </div>
          ))}
        </div>
      </div>

      <Link
        href="/inicio"
        className="offline-retry-link"
        style={{
          display: "inline-flex",
          height: 40,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 12,
          background: "var(--offline-primary)",
          padding: "0 24px",
          fontSize: 14,
          fontWeight: 600,
          color: "var(--offline-primary-fg)",
          textDecoration: "none",
          cursor: "pointer",
        }}
      >
        Ir al inicio
      </Link>
    </div>
  )
}
