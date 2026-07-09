## ADDED Requirements

### Requirement: Corroborar un resumen con su PDF

Desde un resumen puntual en la vista Tarjetas, el sistema SHALL permitir "Corroborar con IA": subir el PDF de ESE resumen (≤15MB), extraerlo con IA y compararlo contra los movimientos ya cargados en el ciclo de ese resumen. El uso SHALL contar contra el límite diario de IA del usuario. El sistema NUNCA SHALL modificar movimientos sin confirmación explícita.

#### Scenario: Subir el PDF del resumen a corroborar

- **WHEN** el usuario abre "Corroborar con IA" en un resumen y sube un PDF válido (≤15MB)
- **THEN** la IA extrae las líneas del PDF y el sistema pasa a la pantalla de diff sin modificar nada todavía

#### Scenario: El diff es del resumen puntual

- **WHEN** se corrobora un resumen
- **THEN** la comparación es contra los movimientos de ESE ciclo (ese resumen), no de toda la tarjeta

### Requirement: Diff entre el PDF y lo cargado

El sistema SHALL comparar cada línea del PDF contra los movimientos del ciclo, matcheando por comercio normalizado (misma normalización que `purchase_key`), monto y —cuando aplique— número de cuota, y SHALL clasificar el resultado en: **falta** (línea del PDF sin movimiento equivalente cargado), **sobra** (movimiento cargado sin línea equivalente en el PDF), y **diferencia de monto** (matchea el comercio/cuota pero el importe difiere).

#### Scenario: Línea del PDF que falta

- **WHEN** el PDF tiene una línea (comercio/monto/cuota) que no está entre los movimientos del ciclo
- **THEN** se lista como "falta"

#### Scenario: Movimiento cargado que sobra

- **WHEN** un movimiento del ciclo no tiene línea equivalente en el PDF
- **THEN** se lista como "sobra"

#### Scenario: Diferencia de monto

- **WHEN** una línea del PDF matchea un movimiento por comercio (y cuota si aplica) pero con importe distinto
- **THEN** se lista como "diferencia de monto", mostrando ambos importes (PDF vs cargado)

### Requirement: Revisión y aplicación selectiva de lo faltante

La pantalla de diff SHALL mostrar los tres grupos (falta / sobra / diferencia) y SHALL permitir al usuario elegir qué **agregar** de lo que falta. La aplicación SHALL crear solo los movimientos que el usuario tildó; por defecto NO SHALL crearse nada automáticamente. Al agregar una línea de cuota, el sistema SHALL agregar también sus proyecciones de cuotas futuras (misma proyección del import: fecha anclada al `close_date` del resumen + tabla "Cuotas a vencer" cuando esté disponible).

#### Scenario: Agregar una línea faltante simple

- **WHEN** el usuario tilda una línea faltante (gasto simple) y confirma
- **THEN** se crea ese movimiento en el resumen y no se toca nada más

#### Scenario: Agregar una cuota faltante proyecta sus futuras

- **WHEN** el usuario tilda una línea faltante que es una cuota y confirma
- **THEN** se crea esa cuota en el resumen y se proyectan sus cuotas futuras en los ciclos siguientes

#### Scenario: No se aplica nada sin confirmar

- **WHEN** el usuario cierra la pantalla de diff sin confirmar
- **THEN** no se crea ni modifica ningún movimiento

### Requirement: Lo que sobra se marca, no se borra

Los movimientos clasificados como **sobra** SHALL solo listarse/marcarse para que el usuario decida; el sistema NUNCA SHALL borrarlos automáticamente al corroborar.

#### Scenario: Sobra un movimiento

- **WHEN** el diff detecta un movimiento cargado que no está en el PDF
- **THEN** se lo marca como "sobra" para revisión, sin borrarlo

### Requirement: Alta reconciliable sin duplicar

Al aplicar lo faltante, el sistema SHALL dar de alta los movimientos de forma idempotente/reconciliable con lo ya cargado (reusando el mecanismo del import): re-corroborar o agregar algo que ya existe NO SHALL duplicarlo.

#### Scenario: Re-corroborar no duplica

- **WHEN** el usuario corrobora el mismo resumen dos veces y agrega lo mismo
- **THEN** no se duplican movimientos ni cuotas (se reconcilian con lo existente)
