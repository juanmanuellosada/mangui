## ADDED Requirements

### Requirement: Tipos de meta
El sistema SHALL soportar tres tipos de meta: `income` (ingreso), `saving` (ahorro) y `reduction` (reducción). Los tres tipos SHALL compartir el mismo conjunto de campos comunes y diferir únicamente en su objetivo (target) y en qué movimientos miden.

#### Scenario: Crear meta de cada tipo
- **WHEN** el usuario abre el modal de nueva meta y elige un tipo
- **THEN** el formulario muestra los campos comunes (nombre, icono, moneda, período, recurrencia, flag global, alcance) y los campos específicos del tipo elegido

#### Scenario: Migración de metas existentes
- **WHEN** se aplica la migración de schema
- **THEN** las metas existentes de tipo `saving` y `reduction` se conservan sin pérdida de datos y quedan adaptadas al nuevo modelo con valores por defecto válidos en los campos nuevos

### Requirement: Campos comunes de una meta
Toda meta SHALL tener: `name` (texto, requerido), `icon` (emoji, identificador lucide o URL de imagen), `currency` (`ARS` o `USD`), un período, un flag `is_global`, un flag `recurring`, y un alcance de cuentas y categorías cuando no es global.

#### Scenario: Icono desde el catálogo de categorías
- **WHEN** el usuario abre el selector de icono de la meta
- **THEN** se muestra el mismo selector usado por categorías (logos, emojis y subida de imagen) y el valor elegido se guarda en `icon`

#### Scenario: Nombre requerido
- **WHEN** el usuario intenta guardar una meta sin nombre
- **THEN** el sistema bloquea el guardado y muestra un error de validación en el campo nombre

### Requirement: Período de la meta
Una meta SHALL tener un período definido por un preset (`weekly`, `biweekly`, `monthly`, `quarterly`, `annual`) o `custom`. El sistema SHALL mostrar siempre una fecha de inicio y una fecha de fin. Al elegir un preset, el sistema SHALL autocompletar la fecha de fin a partir de la fecha de inicio según el preset. En `custom`, el usuario SHALL poder editar ambas fechas libremente.

#### Scenario: Elegir un preset autocompleta el fin
- **WHEN** el usuario selecciona un preset de período y una fecha de inicio
- **THEN** el sistema calcula y muestra automáticamente la fecha de fin correspondiente al preset

#### Scenario: Período personalizado
- **WHEN** el usuario elige el período `custom`
- **THEN** puede editar manualmente la fecha de inicio y la fecha de fin, y el sistema valida que el fin sea posterior al inicio

### Requirement: Alcance global o específico
Una meta SHALL exponer un flag `is_global`. Cuando está activo, la meta afecta a todas las cuentas y categorías y el sistema NO SHALL mostrar los selectores de cuenta ni de categoría. Cuando está inactivo, el sistema SHALL mostrar selectores multi de cuenta y de categoría, y la meta SHALL aplicar solo al alcance seleccionado.

#### Scenario: Meta global oculta selectores
- **WHEN** el usuario activa el flag global
- **THEN** los selectores de cuenta y categoría se ocultan y la meta se evalúa sobre todos los movimientos

#### Scenario: Meta específica con alcance multi
- **WHEN** el usuario desactiva el flag global
- **THEN** aparecen los selectores multi de cuenta y categoría y la meta se evalúa solo sobre los movimientos de las cuentas y categorías seleccionadas

### Requirement: Objetivo y progreso por tipo
El sistema SHALL calcular el progreso de cada meta según su tipo, sobre los movimientos dentro del período y el alcance de la meta.

#### Scenario: Meta de ingreso
- **WHEN** existe una meta `income` con un monto objetivo
- **THEN** el progreso es la suma de los movimientos de ingreso del alcance/período dividido por el monto objetivo

#### Scenario: Meta de ahorro (neto)
- **WHEN** existe una meta `saving` con un monto objetivo
- **THEN** el progreso usa el neto del período (suma de ingresos menos suma de gastos del alcance) dividido por el monto objetivo

#### Scenario: Ahorro con neto negativo
- **WHEN** en una meta `saving` los gastos superan a los ingresos del período (neto negativo)
- **THEN** el sistema muestra el porcentaje negativo en rojo (no lo clampa a 0%), mientras que la longitud visual de la barra se clampa a 0

#### Scenario: Meta de reducción con baseline calculado
- **WHEN** el usuario crea una meta `reduction` con una o varias categorías y un porcentaje de reducción, sin ingresar baseline manual
- **THEN** el sistema calcula el baseline a partir del historial (promedio de gasto de los últimos meses completos) y autocalcula el monto objetivo como `baseline × (1 − %/100)`

#### Scenario: Meta de reducción con baseline manual
- **WHEN** el usuario ingresa un baseline manual y un porcentaje de reducción
- **THEN** el monto objetivo se recalcula como `baseline × (1 − %/100)` y el progreso mide el gasto del alcance contra ese objetivo

### Requirement: Recurrencia con renovación e historial
Una meta marcada como `recurring` SHALL, al finalizar su período, renovarse automáticamente creando el siguiente período y archivando el período anterior como historial consultable.

#### Scenario: Renovación al terminar el período
- **WHEN** una meta recurrente alcanza su fecha de fin
- **THEN** el sistema archiva el resultado del período como historial y crea un nuevo período con el mismo objetivo y alcance, reiniciando el progreso

#### Scenario: Meta no recurrente
- **WHEN** una meta no recurrente alcanza su fecha de fin
- **THEN** la meta queda finalizada sin crear un nuevo período

### Requirement: Lista de metas con filtros
La lista de metas SHALL ofrecer los mismos filtros que la lista de presupuestos, adaptados a metas: búsqueda por nombre, filtro por tipo, filtro por estado (activa/completada), filtro por moneda, multiselect de categorías y cuentas, y un control de orden (recientes, nombre, progreso, fecha de fin).

#### Scenario: Filtrar por tipo y estado
- **WHEN** el usuario selecciona un tipo y un estado en los filtros
- **THEN** la lista muestra solo las metas que cumplen ambos criterios

#### Scenario: Ordenar por progreso
- **WHEN** el usuario elige ordenar por progreso
- **THEN** las metas se ordenan por su porcentaje de avance en la dirección indicada

### Requirement: Barra de progreso en la lista
Cada meta en la lista SHALL mostrar una barra de progreso que se colorea según el porcentaje de avance hacia la meta, usando un componente compartido por los tres tipos.

#### Scenario: Coloreado por avance
- **WHEN** se muestra una meta en la lista
- **THEN** la barra refleja el porcentaje de avance y cambia de color según el estado (en curso, cerca, alcanzada/excedida)

### Requirement: Borrado múltiple en la lista
La lista de metas SHALL permitir entrar en modo selección, seleccionar varias metas y borrarlas en lote, usando el mismo patrón de selección que las demás listas de la app.

#### Scenario: Eliminar varias metas
- **WHEN** el usuario entra en modo selección, marca varias metas y confirma la eliminación
- **THEN** todas las metas seleccionadas se eliminan y la lista se actualiza

### Requirement: Modal de meta alineado a Nuevo movimiento
El modal de creación/edición de meta SHALL reutilizar los mismos componentes que el modal de Nuevo movimiento: selector de moneda, input de monto, selectores de cuenta y categoría, y selector de fecha.

#### Scenario: Componentes compartidos
- **WHEN** el usuario abre el modal de meta
- **THEN** los controles de moneda, monto, cuenta, categoría y fecha son los mismos componentes usados en el modal de Nuevo movimiento
