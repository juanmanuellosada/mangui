## ADDED Requirements

### Requirement: Importación de resumen en PDF con IA

El sistema SHALL permitir importar un resumen de tarjeta en PDF (≤15MB) desde la sección Tarjetas, leerlo con IA y extraer las líneas de consumo. El flujo SHALL constar de subir → revisar → confirmar dentro de un `MangoSheet`, y NUNCA SHALL guardar movimientos sin confirmación explícita del usuario. El uso SHALL contar contra el límite diario de IA del usuario.

#### Scenario: Subir y leer un resumen

- **WHEN** el usuario elige una tarjeta y sube un PDF de resumen válido (≤15MB)
- **THEN** la IA extrae las líneas de consumo y el sistema pasa a la pantalla de revisión sin persistir nada todavía

#### Scenario: Nada se guarda sin confirmar

- **WHEN** el usuario cierra el flujo en la pantalla de revisión sin confirmar
- **THEN** no se crea ningún movimiento, compra en cuotas ni transacción recurrente

#### Scenario: Líneas de pago y saldo no son consumos

- **WHEN** el resumen contiene líneas de pago del período anterior, saldo anterior o devoluciones (p. ej. "SU PAGO", "SALDO ANTERIOR", "DEV.IMP.")
- **THEN** esas líneas NO se incluyen como gastos a crear en la preview

### Requirement: Clasificación de cada línea

La IA SHALL clasificar cada línea de consumo como **cuota**, **suscripción** o **gasto simple**, y SHALL extraer para cada una: descripción, monto, moneda, fecha de compra, la categoría de gasto sugerida (nombre exacto de la lista del usuario o null) y —cuando sea cuota— el número de cuota y el total de cuotas (N/T).

#### Scenario: Línea en cuotas

- **WHEN** una línea muestra un indicador de cuota (p. ej. `04/06`)
- **THEN** se clasifica como cuota con número de cuota = 4 y total = 6

#### Scenario: Línea de suscripción

- **WHEN** una línea corresponde a un cargo mensual recurrente de un servicio (p. ej. Claude, Netflix, Spotify) sin indicador de cuotas
- **THEN** se clasifica como suscripción

#### Scenario: Gasto simple

- **WHEN** una línea no es cuota ni suscripción reconocible
- **THEN** se clasifica como gasto simple del ciclo leído

### Requirement: Proyección de cuotas futuras

Para cada línea clasificada como cuota con cuotas por vencer, el sistema SHALL reconstruir una compra en cuotas (`installment_purchases`) y proyectar las cuotas faltantes (desde la cuota actual N hasta T). El monto de cada cuota proyectada SHALL ser el valor de la cuota leída en el resumen (cuota fija). La fecha/período de cada cuota proyectada SHALL estimarse a partir del ciclo de facturación del resumen y el número de cuota, manteniendo el espaciado mensual. Las cuotas proyectadas SHALL montarse sobre la maquinaria de cuotas existente (aparecen en los ciclos futuros correspondientes).

#### Scenario: Proyectar las cuotas restantes

- **WHEN** el resumen leído contiene una compra en cuota 1/6
- **THEN** la preview incluye esa cuota y las 5 cuotas restantes (2/6 … 6/6) distribuidas un mes por ciclo hacia adelante

#### Scenario: Cuota intermedia

- **WHEN** el resumen leído contiene una compra en cuota 4/6
- **THEN** la preview proyecta las cuotas 5/6 y 6/6 (las ya transcurridas no se recrean en este import)

#### Scenario: Chequeo de suma contra el PDF

- **WHEN** el PDF trae una tabla agregada de "cuotas a vencer" por mes
- **THEN** el sistema la usa solo como verificación de que la suma de cuotas proyectadas es coherente, no como fuente del monto por compra

### Requirement: Preview agrupada por resumen con aprobación por resumen

La pantalla de revisión SHALL agrupar los gastos a crear **por resumen** (el ciclo leído más cada ciclo futuro que reciba cuotas proyectadas) y SHALL permitir al usuario aprobar resumen por resumen. Cada grupo SHALL mostrar su período/ciclo y el total de los gastos que se crearán en él.

#### Scenario: Grupos por ciclo

- **WHEN** el import proyecta cuotas hacia ciclos futuros
- **THEN** la preview muestra un grupo por cada ciclo (el leído y los futuros), cada uno con sus líneas y su total

#### Scenario: Aprobar por resumen

- **WHEN** el usuario aprueba el grupo de un resumen
- **THEN** se confirman los gastos de ese resumen y el usuario continúa con los demás grupos, sin verse obligado a aprobar todo de una sola vez

### Requirement: Propagación de correcciones a cuotas futuras

En la preview, editar un atributo de una compra en cuotas (categoría, descripción, monto de cuota, o incluir/excluir) SHALL propagarse a todas las cuotas futuras proyectadas de esa misma compra antes de guardar. Editar una línea que no es cuota SHALL afectar solo a esa línea.

#### Scenario: Cambiar la categoría de una compra en cuotas

- **WHEN** el usuario cambia la categoría de la cuota 1/6 en la preview
- **THEN** las cuotas 2/6 … 6/6 proyectadas quedan con la misma categoría

#### Scenario: Excluir una compra en cuotas

- **WHEN** el usuario desmarca "incluir" en una compra en cuotas
- **THEN** ni esa cuota ni sus cuotas futuras proyectadas se crean

### Requirement: Reconciliación por identidad de compra

Cada cuota creada por el import SHALL guardar la identidad de su compra (comercio + fecha de compra + total de cuotas + número de cuota). Al importar un resumen posterior, si una línea real coincide con una cuota ya proyectada de una compra existente, el sistema SHALL **actualizar** esa cuota con el dato real (monto/fecha) en vez de crear un duplicado. El import SHALL seguir siendo idempotente por resumen (reimportar el mismo resumen no duplica).

#### Scenario: Cuota ya proyectada llega en el resumen real

- **WHEN** el usuario importa el resumen del mes siguiente y este trae una cuota (p. ej. 2/6) que ya había sido proyectada en un import anterior
- **THEN** el sistema reconoce la compra por su identidad y actualiza la cuota existente con el dato real, sin crear una segunda cuota 2/6

#### Scenario: Reimportar el mismo resumen

- **WHEN** el usuario vuelve a importar exactamente el mismo resumen
- **THEN** no se duplican movimientos ni cuotas (idempotencia por resumen)

#### Scenario: Compra nueva en el resumen real

- **WHEN** un resumen posterior trae una compra en cuotas que no fue proyectada antes
- **THEN** el sistema la reconstruye y proyecta sus cuotas futuras como una compra nueva

### Requirement: Sugerencia de suscripción como recurrente

Para cada línea clasificada como suscripción, la preview SHALL mostrar un toggle "crear como recurrente". La transacción recurrente SHALL crearse **solo si el usuario activa el toggle y confirma**; por defecto SHALL estar en un estado que no crea nada automáticamente.

#### Scenario: Aceptar crear recurrente

- **WHEN** el usuario activa "crear como recurrente" en una línea de suscripción y confirma el import
- **THEN** se crea una transacción recurrente para esa suscripción además del movimiento del período

#### Scenario: No crear recurrente

- **WHEN** el usuario deja el toggle desactivado en una línea de suscripción
- **THEN** la línea se importa como gasto del período pero no se crea ninguna transacción recurrente

### Requirement: Manejo de líneas en dólares

Las líneas en moneda extranjera SHALL persistirse con su `original_currency`, el `dollar_type` correspondiente y un `converted_amount` no nulo. Cuando el PDF no traiga el equivalente en pesos de una línea USD, el flujo SHALL pedir la cotización manualmente antes de guardar (no hay cotización "tarjeta" en vivo en la app).

#### Scenario: Línea USD con equivalente en el PDF

- **WHEN** una línea en USD trae su monto en pesos en el resumen
- **THEN** se persiste con `original_currency = 'USD'` y `converted_amount` = el monto en pesos del PDF

#### Scenario: Línea USD sin equivalente en el PDF

- **WHEN** una línea en USD no trae su monto en pesos en el resumen
- **THEN** el flujo pide la cotización manual y calcula `converted_amount` antes de guardar, sin dejarlo nulo
