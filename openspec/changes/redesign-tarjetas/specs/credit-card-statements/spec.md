## ADDED Requirements

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
