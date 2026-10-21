# Radar inteligente

El Radar del inicio distingue tres tipos de señales calculadas sobre los movimientos registrados:

- **Para revisar:** un gasto inusual respecto del promedio reciente de su categoría.
- **Proyección:** una estimación del gasto al cierre del mes, no un límite de presupuesto.
- **Próximos 7 días:** movimientos previstos que ya se registraron.

Cada señal permite abrir la sección correspondiente. Los montos se muestran en ARS; los movimientos en otra moneda solo se suman si tienen conversión registrada. Las señales no crean movimientos ni activan nuevos canales de notificación.

La interfaz incluye estados de carga, error con reintento y ausencia de señales. La comprobación aislada se ejecuta con `node --experimental-strip-types e2e/radar.spec.ts`; no requiere iniciar sesión ni acceder a datos externos.
