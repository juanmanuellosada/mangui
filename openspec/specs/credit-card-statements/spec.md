# credit-card-statements Specification

## Purpose
TBD - created by archiving change redesign-tarjetas. Update Purpose after archive.
## Requirements
### Requirement: Listado de todas las tarjetas de crédito

La sección Tarjetas SHALL mostrar todas las cuentas del usuario de tipo `tarjeta_credito` como una lista vertical de bloques, un bloque por tarjeta, sin necesidad de seleccionar una sola a la vez.

#### Scenario: Usuario con varias tarjetas

- **WHEN** el usuario abre la sección Tarjetas y tiene 2 o más tarjetas de crédito
- **THEN** se muestra un bloque por cada tarjeta, cada uno con su visual (`CreditCardVisual`) y su resumen seleccionado

#### Scenario: Usuario sin tarjetas

- **WHEN** el usuario no tiene ninguna tarjeta de crédito
- **THEN** se muestra un estado vacío con la acción de crear una tarjeta

### Requirement: Resúmenes virtuales autocalculados

El sistema SHALL calcular cada resumen en vivo a partir de los movimientos de su ciclo de facturación, usando los helpers de ciclo de `src/lib/cards.ts`. No SHALL requerir una fila persistida en `card_statements` para que un resumen exista o se muestre.

#### Scenario: Total del resumen

- **WHEN** se muestra un resumen de un ciclo
- **THEN** su total es la suma de `converted_amount ?? amount` de los movimientos `expense` cuya fecha cae dentro del rango del ciclo

#### Scenario: Editar un gasto recalcula el resumen no pagado

- **WHEN** el usuario edita o agrega un movimiento que cae en un ciclo cuyo resumen no está pagado
- **THEN** el total del resumen se recalcula automáticamente

#### Scenario: Persistencia solo al pagar

- **WHEN** el usuario registra el pago de un resumen
- **THEN** recién entonces se crea/actualiza una fila en `card_statements` con `status`, `paid_amount`, `paid_date`, `paid_from_account_id`

### Requirement: Navegación entre resúmenes de una tarjeta

Cada bloque de tarjeta SHALL permitir navegar ‹ anterior / siguiente › entre los resúmenes de esa tarjeta. El conjunto de resúmenes navegables SHALL abarcar desde el ciclo del primer movimiento de la tarjeta hasta el ciclo en curso, incluyendo ciclos futuros que contengan movimientos (cuotas).

#### Scenario: Navegar al resumen anterior

- **WHEN** el usuario está viendo el resumen en curso y presiona ‹ anterior
- **THEN** se muestra el resumen del ciclo inmediatamente anterior con su total y estado

#### Scenario: Límites de navegación

- **WHEN** el usuario está en el resumen más antiguo o en el más nuevo disponible
- **THEN** el control de navegación hacia ese extremo se deshabilita

### Requirement: Alta de gastos en resúmenes no pagados

El sistema SHALL permitir agregar un gasto a un resumen mientras su estado no sea `pagado`. La acción "+ Gasto" SHALL abrir el `MovementForm` preseteado a la tarjeta del bloque y con la fecha por defecto dentro del ciclo de ese resumen.

#### Scenario: Agregar gasto olvidado a un resumen no pagado

- **WHEN** el usuario abre "+ Gasto" en un resumen con estado distinto de `pagado`
- **THEN** el formulario de movimiento se abre con la cuenta = esa tarjeta y la fecha por defecto dentro del ciclo del resumen

#### Scenario: Resumen pagado no admite altas

- **WHEN** un resumen tiene estado `pagado`
- **THEN** la acción "+ Gasto" no está disponible para ese resumen

### Requirement: Registro de pago con inputs canónicos

El modal de Registrar pago SHALL usar los mismos componentes de input que el resto de la app: `MoneyInput` para el monto (con la `currency` de la tarjeta), `MangoDatePicker` para la fecha, y `MangoSelect` con `AccountIconChip` y búsqueda para la cuenta de origen.

#### Scenario: Monto con la moneda de la tarjeta

- **WHEN** se abre el modal de pago de una tarjeta en USD
- **THEN** el `MoneyInput` muestra el prefijo de moneda correspondiente a la tarjeta (no ARS por defecto)

#### Scenario: Selector de fecha unificado

- **WHEN** el usuario elige la fecha de pago
- **THEN** usa el `MangoDatePicker` (no un `<input type="date">` nativo)

#### Scenario: Selector de cuenta con íconos y búsqueda

- **WHEN** el usuario elige la cuenta de origen del pago
- **THEN** el `MangoSelect` muestra cada cuenta con su `AccountIconChip` y permite buscar

### Requirement: Doble adjunto al registrar el pago

Al registrar un pago el sistema SHALL permitir adjuntar dos archivos independientes: uno con `kind = 'resumen'` y otro con `kind = 'comprobante'`, ambos vinculados al `card_statements` correspondiente vía `statement_id`. SHALL reusar `AttachmentSlot` y los helpers de `src/lib/attachments.ts`.

#### Scenario: Adjuntar resumen y comprobante

- **WHEN** el usuario registra un pago y adjunta un archivo de resumen y otro de comprobante
- **THEN** se guardan dos `movement_attachments` con `statement_id` apuntando al resumen y `kind` `resumen` y `comprobante` respectivamente

#### Scenario: Ver adjuntos de un resumen pagado

- **WHEN** el usuario abre un resumen ya pagado que tiene adjuntos
- **THEN** se muestran los adjuntos de resumen y comprobante con su preview vía URL firmada

### Requirement: Pago de resúmenes con consumos en más de una moneda

Cuando un resumen contiene consumos en más de una moneda (p. ej. pesos y dólares), el sistema SHALL calcular un subtotal por cada moneda (agrupando por `original_currency`, sin convertir) y, al registrar el pago, SHALL pedir una cuenta de origen y un monto por cada moneda con saldo distinto de cero. La cuenta de cada moneda SHALL filtrarse a cuentas de esa misma moneda. La fila `card_statements` SHALL persistir el pago de cada moneda (monto, cuenta de origen) sin perder ninguna de las dos.

#### Scenario: Resumen con consumos en pesos y dólares

- **WHEN** el usuario abre el resumen de una tarjeta que tiene consumos en ARS y en USD
- **THEN** el resumen muestra dos subtotales (uno en ARS y uno en USD) en vez de un único total convertido

#### Scenario: Registrar pago de un resumen multi-moneda

- **WHEN** el usuario registra el pago de un resumen con saldo en ARS y en USD
- **THEN** el modal pide DOS cuentas de origen y DOS montos —una cuenta ARS para el saldo en pesos y una cuenta USD para el saldo en dólares— y al confirmar persiste ambos pagos

#### Scenario: Resumen con una sola moneda

- **WHEN** un resumen tiene consumos en una sola moneda
- **THEN** el modal pide una única cuenta y monto de esa moneda (comportamiento previo)

### Requirement: Gastos del resumen unificados con íconos de categoría

La lista "Gastos del resumen" SHALL incluir TODOS los movimientos del ciclo —gastos regulares y cuotas— en una sola lista. Cada fila SHALL mostrar el ícono de la categoría del movimiento (no un ícono fijo). Las filas de cuota SHALL indicar que son cuotas (p. ej. "Cuota X/Y"). SHALL eliminarse la sección separada "Cuotas que caen en este resumen".

#### Scenario: Cuotas dentro de la lista de gastos

- **WHEN** un resumen tiene cuotas que caen en su ciclo
- **THEN** esas cuotas aparecen dentro de "Gastos del resumen" marcadas como cuota ("Cuota X/Y"), no en una sección aparte

#### Scenario: Ícono de categoría por fila

- **WHEN** se renderiza una fila de gasto del resumen
- **THEN** muestra el `CategoryIconChip` de la categoría del movimiento

#### Scenario: Editar o borrar un gasto regular desde el resumen

- **WHEN** el usuario toca una fila de gasto regular (no cuota) en "Gastos del resumen"
- **THEN** se abre el modal de edición del movimiento, con la posibilidad de editarlo o borrarlo

### Requirement: Detalle de cuotas como modal con postergación en cascada

El detalle de una compra en cuotas SHALL abrirse como modal (`MangoSheet`) desde la lista de gastos del resumen. Dentro del detalle, cada cuota NO pagada SHALL poder moverse un mes adelante o atrás; al mover una cuota, esa cuota y TODAS las siguientes SHALL desplazarse el mismo mes (cascada), manteniendo el espaciado mensual. Las cuotas que caen en un resumen ya pagado NO SHALL moverse, y un movimiento NO SHALL desplazar ninguna cuota afectada hacia un resumen ya pagado.

#### Scenario: Abrir detalle como modal

- **WHEN** el usuario toca una cuota en la lista de gastos del resumen
- **THEN** se abre un modal con el detalle de la compra en cuotas (sin navegar fuera de la sección)

#### Scenario: Postergar una cuota en cascada

- **WHEN** el usuario mueve una cuota no pagada un mes adelante
- **THEN** esa cuota y todas las posteriores se corren un mes, y los totales de los resúmenes afectados se recalculan

#### Scenario: Confirmación antes de mover

- **WHEN** el usuario toca −1 / +1 mes en una cuota
- **THEN** se pide confirmación (indicando cuántas cuotas se moverán y hacia dónde) antes de aplicar el cambio

#### Scenario: Cuotas pagadas bloqueadas

- **WHEN** una cuota cae en un resumen ya pagado
- **THEN** no ofrece controles de mover y ningún desplazamiento puede llevar otra cuota a ese resumen pagado

### Requirement: Editar la compra en cuotas

Desde el modal de detalle de cuotas el usuario SHALL poder editar la compra completa: descripción, categoría, monto total, cuenta (tarjeta) y tipo de dólar (cuando aplique). Al guardar, el sistema SHALL recalcular las cuotas NO pagadas (distribuyendo el monto total restante entre ellas, con la última absorbiendo el redondeo) y actualizar su categoría/cuenta/tipo de dólar; las cuotas ya pagadas NO SHALL modificarse. La cantidad de cuotas NO se edita en este flujo.

#### Scenario: Editar y recalcular cuotas no pagadas

- **WHEN** el usuario edita el monto total o la categoría de una compra en cuotas y guarda
- **THEN** las cuotas no pagadas se recalculan/actualizan y las pagadas quedan igual, manteniendo el total coherente

#### Scenario: Acceso a editar desde el detalle

- **WHEN** el usuario abre el modal de detalle de cuotas
- **THEN** dispone de una acción "Editar compra" que abre el formulario de edición

