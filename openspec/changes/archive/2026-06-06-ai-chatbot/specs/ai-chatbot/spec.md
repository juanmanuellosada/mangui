## ADDED Requirements

### Requirement: Chat asistente sobre las finanzas del usuario

La sección `/ia` SHALL ofrecer un chat conversacional con streaming que responde sobre las finanzas del usuario autenticado, usando un modelo con tool-calling. El modelo NO SHALL acceder a la base directamente: solo SHALL invocar herramientas server-side predefinidas.

#### Scenario: Consulta respondida con datos propios

- **WHEN** el usuario pregunta "¿cuánto gasté este mes en supermercado?"
- **THEN** el asistente usa una herramienta de lectura y responde con datos del propio usuario

#### Scenario: Streaming de la respuesta

- **WHEN** el asistente responde
- **THEN** el texto se muestra en streaming en el chat

### Requirement: Aislamiento estricto por usuario

Todas las herramientas de lectura SHALL ejecutarse con el cliente de sesión (RLS), obteniendo el `user_id` del usuario autenticado (cookie) y NUNCA de argumentos provistos por el modelo. El asistente NO SHALL poder acceder a datos de otro usuario bajo ninguna instrucción.

#### Scenario: Intento de acceder a otros datos

- **WHEN** el usuario (o un prompt adversarial) pide datos de otro usuario o de toda la base
- **THEN** las herramientas solo devuelven filas del usuario autenticado (RLS) y el asistente rechaza el pedido fuera de alcance

#### Scenario: Sin SQL libre

- **WHEN** el modelo procesa un mensaje
- **THEN** solo puede invocar herramientas parametrizadas (no ejecuta SQL arbitrario)

### Requirement: Escritura solo con confirmación

La creación de un movimiento desde el chat SHALL proponerse como borrador y requerir confirmación explícita del usuario antes de guardarse. El asistente NO SHALL insertar ni modificar datos sin confirmación.

#### Scenario: Crear movimiento propuesto

- **WHEN** el usuario pide "cargá un gasto de 5000 en el súper"
- **THEN** el chat muestra un borrador editable y solo guarda el movimiento cuando el usuario confirma

#### Scenario: Cancelar sin guardar

- **WHEN** el usuario no confirma el borrador
- **THEN** no se crea ningún movimiento

### Requirement: Límite de uso y alcance temático

El chat SHALL respetar el límite diario por usuario (reusa `ai_usage`; `ai_unlimited` lo saltea) contando por mensaje del usuario, y SHALL acotar la cantidad de pasos de herramientas por mensaje. El asistente SHALL responder solo sobre el dominio financiero del usuario.

#### Scenario: Límite diario alcanzado

- **WHEN** un usuario sin `ai_unlimited` supera el límite diario de mensajes
- **THEN** el chat informa el límite y no procesa el mensaje

#### Scenario: Pedido fuera de dominio

- **WHEN** el usuario pide algo no relacionado con sus finanzas
- **THEN** el asistente declina amablemente y reencauza al uso financiero

### Requirement: /ia como interfaz única de IA

El acceso de IA de la app SHALL llevar al chat en `/ia`. El parseo de movimiento por IA previo SHALL quedar integrado en el chat. El quick-add manual (movimiento/transferencia) SHALL mantenerse.

#### Scenario: Acceso de IA abre el chat

- **WHEN** el usuario toca el acceso de IA ("Cargar con IA" / bottom-nav / quick-add IA)
- **THEN** se abre el chat en `/ia`
