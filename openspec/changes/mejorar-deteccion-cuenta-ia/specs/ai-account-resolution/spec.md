## ADDED Requirements

### Requirement: Selección de cuenta por índice en la extracción por IA

Los flujos de extracción por IA SHALL presentarle al modelo la lista de cuentas del usuario **numerada** y con metadata desambiguadora (tipo y moneda), y el modelo SHALL devolver el **índice** de la cuenta elegida, no su nombre. El sistema SHALL validar que el índice esté dentro del rango de la lista enviada. Si el modelo no puede elegir ninguna, SHALL devolver ausencia de cuenta en lugar de adivinar.

#### Scenario: El modelo elige de la lista numerada

- **WHEN** el usuario dicta "gasté 5000 en el súper con la Visa" y tiene una cuenta `Santander Río - Visa Signature`
- **THEN** el modelo devuelve el índice de esa cuenta y el borrador queda con esa cuenta seleccionada, sin depender de que el nombre se haya escrito completo

#### Scenario: Índice fuera de rango

- **WHEN** el modelo devuelve un índice que no corresponde a ninguna cuenta de la lista enviada
- **THEN** el sistema descarta el índice y trata el resultado como cuenta no resuelta, sin romper la carga del movimiento

#### Scenario: El modelo no identifica ninguna cuenta

- **WHEN** el texto del usuario no menciona ni implica ninguna cuenta
- **THEN** el resultado no trae cuenta y el borrador queda con la cuenta vacía

#### Scenario: Metadata disponible para desambiguar

- **WHEN** el usuario tiene dos cuentas de nombre parecido pero distinta moneda y dice un monto en dólares
- **THEN** la lista enviada al modelo incluye la moneda de cada cuenta, de modo que pueda distinguirlas

### Requirement: Resolución de cuenta por nombre con puntaje y umbral

Cuando el sistema recibe un nombre de cuenta aproximado en lugar de un índice —caso del chat, donde el modelo no ve la lista— SHALL resolverlo con un único resolver compartido que puntúe a los candidatos por **cobertura de tokens** del texto recibido sobre el nombre de la cuenta. El resolver SHALL aplicar un umbral mínimo de confianza, SHALL desempatar de forma determinista sin depender del orden de la lista, y SHALL excluir las cuentas ocultas. El resultado SHALL distinguir explícitamente entre "no se resolvió" y "se resolvió".

#### Scenario: Nombre parcial no contiguo

- **WHEN** el texto recibido es "Santander Visa" y el usuario tiene la cuenta `Santander Río - Visa Signature`
- **THEN** el resolver la devuelve, porque los dos tokens del texto están presentes en el nombre de la cuenta

#### Scenario: Cuenta corta que es parte del nombre de una larga

- **WHEN** el usuario tiene las cuentas `Visa` y `Visa Santander Platinum`, y el texto recibido es "Visa Santander Platinum"
- **THEN** el resolver devuelve `Visa Santander Platinum` y no `Visa`, independientemente de cuál de las dos se haya creado primero

#### Scenario: Ambigüedad entre candidatos

- **WHEN** el texto recibido puntúa prácticamente igual contra dos o más cuentas y ninguna se destaca
- **THEN** el resolver informa que no pudo resolver, en lugar de elegir una

#### Scenario: Texto que no se parece a ninguna cuenta

- **WHEN** el texto recibido no alcanza el umbral mínimo de confianza contra ninguna cuenta
- **THEN** el resolver informa que no pudo resolver

#### Scenario: Cuentas ocultas excluidas

- **WHEN** una cuenta marcada como oculta sería la mejor candidata para el texto recibido
- **THEN** el resolver no la considera

#### Scenario: Insensible a mayúsculas y acentos

- **WHEN** el texto recibido es "santander rio" y la cuenta se llama `Santander Río - Visa Signature`
- **THEN** el resolver la encuentra

### Requirement: Aprendizaje de cuenta a partir de movimientos confirmados

El sistema SHALL registrar, cada vez que el usuario confirma un movimiento, la asociación entre el contexto del movimiento y la cuenta elegida, usando dos claves de contexto: **categoría + moneda** y **comercio** derivado de la nota. Ese historial SHALL usarse como un término más del puntaje del resolver, nunca como una regla que decida por sí sola. El registro SHALL ser tolerante a fallos: un error al aprender NO SHALL impedir que el movimiento se guarde. Los datos aprendidos SHALL estar aislados por usuario, obteniendo la identidad del usuario autenticado y nunca de un parámetro del cliente.

#### Scenario: Se aprende al confirmar

- **WHEN** el usuario guarda un movimiento de categoría "Rendimientos" en USD sobre una cuenta de inversión
- **THEN** el sistema registra esa asociación y aumenta su contador de repeticiones

#### Scenario: El historial desempata un parcial ambiguo

- **WHEN** el usuario ya cargó varias veces "Rendimientos" en USD sobre la misma cuenta, y ahora el texto recibido se parece parcialmente a dos cuentas
- **THEN** el resolver elige la cuenta aprendida para ese contexto

#### Scenario: El historial no decide solo

- **WHEN** existe una cuenta aprendida para el contexto pero el texto recibido no se parece a ninguna cuenta
- **THEN** el prior aprendido no alcanza por sí solo para resolver, y el sistema informa que no pudo resolver

#### Scenario: Umbral mínimo de repeticiones

- **WHEN** una asociación contexto → cuenta se registró menos veces que el mínimo requerido
- **THEN** todavía no influye en el puntaje

#### Scenario: Falla al aprender no rompe el guardado

- **WHEN** el registro del aprendizaje falla
- **THEN** el movimiento igual queda guardado y el usuario no ve ningún error

#### Scenario: Aislamiento por usuario

- **WHEN** se registra o se lee el aprendizaje de cuenta
- **THEN** solo se accede a las filas del usuario autenticado, tomando su identidad de la sesión

### Requirement: Precedencia de señales y ausencia de adivinanza

Al completar la cuenta de un borrador, el sistema SHALL respetar este orden: la elección manual del usuario tiene prioridad sobre todo; luego el índice válido devuelto por el modelo; luego la resolución por puntaje con el prior aprendido. Cuando ninguna señal resuelve la cuenta con confianza suficiente, el sistema SHALL dejar la cuenta vacía y visible para que el usuario la elija, y NO SHALL completarla con una cuenta por defecto ni con la primera de la lista.

#### Scenario: La elección del usuario no se pisa

- **WHEN** el usuario ya seleccionó una cuenta a mano en el borrador y llega un resultado de la IA con otra cuenta
- **THEN** se mantiene la cuenta que eligió el usuario

#### Scenario: El índice del modelo gana sobre el puntaje

- **WHEN** el modelo devuelve un índice válido y además el texto resolvería por puntaje a otra cuenta
- **THEN** se usa la cuenta del índice

#### Scenario: Sin resolución no hay cuenta por defecto

- **WHEN** ninguna señal resuelve la cuenta
- **THEN** el borrador queda con la cuenta vacía y el usuario debe elegirla antes de guardar
