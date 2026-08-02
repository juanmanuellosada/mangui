## MODIFIED Requirements

### Requirement: Escritura solo con confirmación

La creación de un movimiento desde el chat SHALL proponerse como borrador y requerir confirmación explícita del usuario antes de guardarse. El asistente NO SHALL insertar ni modificar datos sin confirmación.

El borrador NO SHALL completar la cuenta con un valor adivinado. Cuando la cuenta mencionada por el usuario no se resuelve con confianza suficiente, el campo SHALL quedar vacío y visible para que el usuario lo complete, y el borrador NO SHALL caer a la primera cuenta del usuario ni a ninguna cuenta por defecto.

#### Scenario: Crear movimiento propuesto

- **WHEN** el usuario pide "cargá un gasto de 5000 en el súper"
- **THEN** el chat muestra un borrador editable y solo guarda el movimiento cuando el usuario confirma

#### Scenario: Cancelar sin guardar

- **WHEN** el usuario no confirma el borrador
- **THEN** no se crea ningún movimiento

#### Scenario: Cuenta no resuelta en el borrador

- **WHEN** el usuario menciona una cuenta que no se resuelve con confianza suficiente
- **THEN** el borrador se muestra con la cuenta vacía y el usuario debe elegirla antes de poder confirmar, sin que el chat haya preseleccionado ninguna
