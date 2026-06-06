## ADDED Requirements

### Requirement: IA servida por la app sin key del usuario

El sistema SHALL ofrecer la interpretación de movimientos por IA usando una API key propia del servidor (variable de entorno), sin pedir ni almacenar ninguna key del usuario. La key NO SHALL exponerse al cliente. El endpoint SHALL exigir usuario autenticado.

#### Scenario: Usuario usa la IA sin configurar nada

- **WHEN** un usuario autenticado interpreta un texto de movimiento
- **THEN** la app responde con el borrador usando la key del servidor, sin haberle pedido ninguna API key

#### Scenario: Falta la key del servidor

- **WHEN** no está configurada la variable de entorno de la key
- **THEN** el endpoint responde con un error claro de configuración (no expone detalles sensibles)

### Requirement: Límite de uso por usuario con excepción ilimitada

El sistema SHALL limitar la cantidad de interpretaciones por usuario por día (tope configurable, por defecto 30). Los usuarios marcados con `ai_unlimited` SHALL quedar exentos del tope. Al superar el tope, el endpoint SHALL responder 429 con un mensaje claro y NO SHALL llamar al proveedor.

#### Scenario: Usuario alcanza el tope diario

- **WHEN** un usuario sin `ai_unlimited` ya hizo 30 interpretaciones en el día e intenta otra
- **THEN** recibe un aviso de límite diario alcanzado y no se realiza la llamada al modelo

#### Scenario: Usuario ilimitado

- **WHEN** un usuario marcado como `ai_unlimited` interpreta un texto
- **THEN** no se aplica el tope diario

#### Scenario: Conteo de uso

- **WHEN** una interpretación se realiza con éxito
- **THEN** se registra el uso (tabla `ai_usage`) para el conteo diario

### Requirement: Sección IA informativa con uso

La sección `/ia` SHALL ser informativa: explicar que la IA viene incluida y mostrar el uso del día del usuario (p. ej. "12/30") o "ilimitado" si corresponde. NO SHALL contener inputs de proveedor, modelo ni API key.

#### Scenario: Ver uso del día

- **WHEN** el usuario abre `/ia`
- **THEN** ve que la IA está incluida y su uso del día (consumidas/tope), o "ilimitado"

#### Scenario: Sin inputs de key

- **WHEN** el usuario abre `/ia`
- **THEN** no hay campos para proveedor, modelo ni API key
