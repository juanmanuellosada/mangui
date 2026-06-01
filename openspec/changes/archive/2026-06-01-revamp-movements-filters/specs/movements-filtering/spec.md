## ADDED Requirements

### Requirement: Layout full-width en desktop

La lista de Movimientos SHALL aprovechar todo el ancho disponible del contenedor en desktop, en lugar de quedar limitada a una columna angosta.

#### Scenario: Ancho en desktop
- **WHEN** el usuario ve Movimientos en una pantalla de escritorio
- **THEN** la lista y la barra de filtros usan el ancho completo del área de contenido

### Requirement: Barra de filtros siempre visible

La barra de filtros SHALL estar siempre visible (sin toggle para mostrarla). En desktop se muestra expandida; en mobile se muestra una fila compacta (buscador + chips de filtros activos) que despliega el resto de los filtros al interactuar.

#### Scenario: Desktop expandida
- **WHEN** el usuario ve Movimientos en desktop
- **THEN** los filtros (búsqueda, tipo, fecha, cuentas, categorías) están visibles sin tener que abrir un panel

#### Scenario: Mobile compacta
- **WHEN** el usuario ve Movimientos en mobile
- **THEN** ve una fila compacta con el buscador y chips de los filtros activos, y puede desplegar el resto

### Requirement: Buscador

El sistema SHALL ofrecer un buscador que filtra los movimientos cuyo texto coincide con la nota/descripción, el nombre de la categoría o el nombre de la cuenta.

#### Scenario: Buscar por nota
- **WHEN** el usuario escribe un texto presente en la nota de un movimiento
- **THEN** la lista muestra ese movimiento

#### Scenario: Buscar por categoría o cuenta
- **WHEN** el usuario escribe el nombre de una categoría o de una cuenta
- **THEN** la lista muestra los movimientos de esa categoría o cuenta

### Requirement: Filtro de fecha por rango

La barra SHALL usar el componente reutilizable de filtro de fecha por rango para acotar los movimientos por fecha.

#### Scenario: Aplicar un rango de fecha
- **WHEN** el usuario elige un rango (preset, operador o calendario) en el filtro de fecha
- **THEN** la lista muestra solo los movimientos dentro de ese rango

### Requirement: Filtro multi-cuenta y multi-categoría con íconos

Los selectores de cuenta y categoría SHALL permitir elegir más de un valor a la vez, con buscador, y renderizar el ícono de cada opción (emoji, logo de catálogo o imagen subida para cuentas; ícono de categoría para categorías).

#### Scenario: Seleccionar varias cuentas
- **WHEN** el usuario selecciona dos o más cuentas en el filtro
- **THEN** la lista muestra movimientos/transferencias de cualquiera de esas cuentas

#### Scenario: Seleccionar varias categorías
- **WHEN** el usuario selecciona dos o más categorías
- **THEN** la lista muestra los movimientos de cualquiera de esas categorías

#### Scenario: Íconos en las opciones
- **WHEN** el usuario abre un selector de cuenta o categoría
- **THEN** cada opción muestra su ícono/logo junto al nombre

### Requirement: Filtrado server-side

El sistema SHALL aplicar los filtros (rango de fecha, tipo, cuentas, categorías, búsqueda) en la consulta a la base de datos, de modo que el resultado no quede limitado a los últimos N registros traídos al cliente.

#### Scenario: Vista de un período viejo
- **WHEN** el usuario filtra por un rango de fecha del año pasado
- **THEN** se muestran los movimientos de ese período aunque no estén entre los más recientes

#### Scenario: Tipo transferencia
- **WHEN** el usuario filtra por tipo "Transferencia"
- **THEN** se muestran solo transferencias; las cuentas filtran por origen o destino

#### Scenario: Categoría no aplica a transferencias
- **WHEN** el usuario filtra por una o más categorías
- **THEN** las transferencias quedan excluidas del resultado (no tienen categoría)
