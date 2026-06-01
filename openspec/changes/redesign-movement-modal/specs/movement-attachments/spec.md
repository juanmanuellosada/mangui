## ADDED Requirements

### Requirement: Adjuntos en gastos

Un movimiento de tipo gasto SHALL admitir hasta dos adjuntos en slots etiquetados "Factura o ticket" y "Recibo / comprobante de pago". El sistema SHALL aceptar imágenes y PDF de hasta ~5MB por archivo.

#### Scenario: Subir factura y recibo
- **WHEN** el usuario carga un gasto y adjunta un archivo en "Factura o ticket" y otro en "Recibo / comprobante de pago"
- **THEN** ambos archivos se almacenan y quedan asociados al movimiento con su `kind` correspondiente (`factura`, `recibo`)

#### Scenario: Rechazo por tipo o tamaño
- **WHEN** el usuario intenta adjuntar un archivo que no es imagen ni PDF, o supera ~5MB
- **THEN** el sistema rechaza el archivo y muestra un mensaje de error sin subirlo

#### Scenario: Gasto sin adjuntos
- **WHEN** el usuario crea un gasto sin adjuntar archivos
- **THEN** el movimiento se crea normalmente sin adjuntos

### Requirement: Adjunto en ingresos

Un movimiento de tipo ingreso SHALL admitir un único adjunto en un slot etiquetado "Comprobante", con las mismas restricciones de formato y tamaño.

#### Scenario: Subir comprobante de ingreso
- **WHEN** el usuario carga un ingreso y adjunta un archivo en "Comprobante"
- **THEN** el archivo se almacena y queda asociado al movimiento con `kind = comprobante`

#### Scenario: Ingreso sin slot de factura/recibo
- **WHEN** el usuario está cargando un ingreso
- **THEN** solo se muestra el slot "Comprobante" y no los slots de factura/recibo

### Requirement: Gestión de adjuntos al crear y al editar

El sistema SHALL permitir subir, visualizar y borrar adjuntos tanto al crear un movimiento como al editar uno existente.

#### Scenario: Ver adjuntos al editar
- **WHEN** el usuario edita un movimiento que tiene adjuntos
- **THEN** los adjuntos existentes se muestran con la opción de abrirlos o borrarlos

#### Scenario: Agregar adjunto al editar
- **WHEN** el usuario edita un movimiento y agrega un adjunto en un slot vacío permitido por el tipo de movimiento
- **THEN** el nuevo adjunto se almacena y se asocia al movimiento

#### Scenario: Borrar adjunto
- **WHEN** el usuario borra un adjunto de un movimiento
- **THEN** el adjunto se elimina del almacenamiento y de la base de datos

#### Scenario: Borrado en cascada
- **WHEN** se elimina un movimiento con adjuntos
- **THEN** sus registros de adjuntos se eliminan automáticamente

### Requirement: Almacenamiento aislado por usuario

Los adjuntos SHALL almacenarse en Supabase Storage bajo rutas con prefijo del usuario, y los registros SHALL estar protegidos por RLS de modo que cada usuario solo accede a sus propios adjuntos.

#### Scenario: Aislamiento entre usuarios
- **WHEN** un usuario consulta o intenta acceder a adjuntos
- **THEN** solo puede ver y operar sobre adjuntos de movimientos que le pertenecen

### Requirement: Transferencias sin adjuntos

Las transferencias NO SHALL ofrecer ni almacenar adjuntos.

#### Scenario: Modo transferencia sin adjuntos
- **WHEN** el usuario está en el modo transferencia del modal
- **THEN** no se muestra ninguna sección de adjuntos
