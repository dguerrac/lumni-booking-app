# Lumni Coworking · Reservas de salas

Prueba técnica Lumni TI. Monorepo TypeScript: React + Express + PostgreSQL.

## Cómo correrlo localmente

Requisitos: Node 20.12 o superior (probado con 22 y 24; ver `.nvmrc`) y Docker (Docker Desktop u OrbStack).

```bash
cp .env.example .env
docker compose up -d
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

- Web: http://localhost:5173
- API: http://localhost:3000/api/health
- Correos capturados (Mailpit): http://localhost:8025

Pruebas: `npm test` (con `docker compose up -d` corriendo: las pruebas del API usan la base `lumni_test`, nunca un mock).

Otros comandos: `npm run typecheck` · `npm run lint`

### Variables de entorno

`.env.example` trae valores que solo sirven en local (la base de Docker y Mailpit), así que la app corre copiándolo sin cambios. `.env` está en `.gitignore`. Al arrancar, el API valida todas las variables a la vez y, si algo falta o es inválido, lista cada problema y se detiene.

| Variable                        | Requerida          | Para qué                                                                                          |
| ------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                  | Sí                 | PostgreSQL de la app                                                                              |
| `TEST_DATABASE_URL`             | Para pruebas       | Base `lumni_test`; las pruebas nunca tocan la base de la app                                      |
| `JWT_SECRET`                    | Sí                 | Firma la sesión. En `NODE_ENV=production` se rechaza el valor de ejemplo y menos de 32 caracteres |
| `SMTP_HOST`, `SMTP_PORT`        | Sí                 | Servidor de correo (Mailpit en local)                                                             |
| `EMAIL_FROM`                    | Sí                 | Remitente del correo de confirmación                                                              |
| `PORT`                          | No (3000)          | Puerto del API                                                                                    |
| `NODE_ENV`                      | No (`development`) | En `production` exige un `JWT_SECRET` real y la cookie de sesión `Secure`                         |
| `EMAIL_FAIL_FIRST_N`            | No (0)             | Solo para demos: hace fallar los primeros N envíos para ver los reintentos                        |
| `ANTHROPIC_API_KEY`, `AI_MODEL` | Parte 2.2          | Asistente con IA (pendiente)                                                                      |

En producción los secretos vendrían del gestor de secretos del proveedor, nunca del repositorio.

## Usuarios de prueba

Creados por `npm run db:seed` (se puede correr varias veces sin duplicar nada).

| Rol       | Correo               | Contraseña   |
| --------- | -------------------- | ------------ |
| Cliente A | cliente.a@lumni.test | ClienteA123! |
| Cliente B | cliente.b@lumni.test | ClienteB123! |
| Admin     | admin@lumni.test     | Admin123!    |

El segundo cliente existe para demostrar que ni el API ni el asistente de IA muestran reservas de otro cliente.

Salas: Andes y Caribe (pequeñas, 4 personas), Pacífico y Amazonas (medianas, 8), Orinoco (grande, 16).

## Arquitectura

```mermaid
flowchart LR
  web["React (Vite)<br/>apps/web"] -->|/api| routes
  chat["Asistente IA<br/>(tool use)"] --> services
  subgraph api["Express 5 · apps/api"]
    routes["routes<br/>HTTP + Zod"] --> services["services<br/>reglas y transacciones"]
    services --> repos["repositories<br/>SQL (Kysely)"]
    services --> domain["domain<br/>funciones puras"]
    worker["worker de correo<br/>(outbox)"]
  end
  routes --> chat
  chat -->|API de Anthropic| llm[("LLM")]
  repos --> pg[("PostgreSQL")]
  worker --> pg
  worker -->|SMTP| mailpit["Mailpit"]
```

El front y el asistente usan **los mismos servicios**. Las garantías importantes (no hay doble reserva, un solo correo por reserva) son restricciones de PostgreSQL, así que ningún camino puede saltárselas.

**Capas del API** (cada módulo en `apps/api/src/modules/<módulo>/`):

| Capa              | Responsabilidad                                                           | No hace                |
| ----------------- | ------------------------------------------------------------------------- | ---------------------- |
| `*.routes.ts`     | HTTP: valida la entrada con Zod, toma la identidad de la sesión, responde | Reglas de negocio, SQL |
| `*.service.ts`    | Reglas de negocio y transacciones                                         | Conocer HTTP           |
| `*.repository.ts` | Consultas SQL con Kysely                                                  | Decidir reglas         |
| `domain/`         | Funciones puras: precios, máquina de estados, franjas, fechas relativas   | I/O, leer el reloj     |

**Estructura** (las carpetas se crean en el paso que las necesita):

```
apps/
  api/src/
    db/            cliente Kysely, migraciones, seed
    http/          middleware de errores y de autenticación
    modules/       auth, rooms, quotes, bookings, admin, emails, assistant
  web/src/         pantallas (cotizar, asistente de 3 pasos, admin, chat)
packages/
  shared/src/      esquemas Zod, tipos y constantes compartidas
```

## Decisiones

El enunciado deja vacíos; la regla es decidir, escribirlo y seguir. Estas son las decisiones tomadas.

| Vacío en el enunciado                                 | Decisión                                                                                                                                    | Por qué                                                                                              |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| ¿La reserva debe terminar antes de las 21:00?         | Sí: inicio ≥ 7:00 y fin ≤ 21:00                                                                                                             | El horario de apertura es cuando se puede usar la sala                                               |
| Horas de inicio permitidas                            | En punto o y media (7:00, 7:30…)                                                                                                            | Coincide con bloques de 30 minutos y simplifica buscar el siguiente horario                          |
| Fechas y horas pasadas                                | Rechazadas; hoy solo con hora de inicio futura (hora de Bogotá)                                                                             | No se puede reservar el pasado                                                                       |
| Festivos                                              | Se ignoran (abre lunes a sábado aunque sea festivo)                                                                                         | No está en el enunciado; requeriría una tabla de festivos                                            |
| Umbrales de descuento                                 | ≥ 4 h → 10 %, ≥ 8 h → 20 %, no acumulables                                                                                                  | "Desde" es inclusivo                                                                                 |
| Base del recargo                                      | 25 % sobre (base − descuento)                                                                                                               | Lo dice el enunciado; tiene prueba explícita                                                         |
| Precio de los extras (no dado)                        | Proyector 30.000 COP fijo por reserva; café 8.000 COP por persona                                                                           | Necesitan un número; están en un solo objeto de configuración                                        |
| ¿Descuento y recargo aplican a los extras?            | No: los extras se suman al final                                                                                                            | Lo más simple de explicar                                                                            |
| Qué reservas bloquean un horario                      | Confirmadas y completadas                                                                                                                   | El enunciado dice "confirmada"; los borradores no bloquean                                           |
| "Siguiente horario disponible el mismo día"           | El primer inicio posterior al pedido, misma duración, que termine antes de las 21:00 y esté libre; si no hay, se dice                       | "Siguiente" es después; evita sugerir el pasado                                                      |
| Cotización de un horario no reservable                | `200` con `bookable: false`, razones y precio; `400` solo si el formato es inválido                                                         | Es una cotización válida de un horario inválido                                                      |
| Endpoints de salas y cotización                       | Públicos (no requieren sesión)                                                                                                              | Cotizar no cambia nada; reservar sí requiere sesión                                                  |
| Sesión                                                | JWT HS256 de 8 horas en cookie `httpOnly`, `SameSite=Lax` (`Secure` en producción); el token solo lleva id y rol                            | JavaScript no puede leer la cookie; no hace falta guardar sesiones en el servidor                    |
| ¿Cuántos borradores puede tener un cliente?           | Uno abierto. Volver a "Reservar" mueve ese borrador al nuevo horario (conserva datos de contacto, limpia extras, vuelve al paso 1)          | "El borrador actual" debe ser uno solo; lo garantiza un índice único parcial en la base de datos     |
| ¿Cuántas reservas confirmadas puede tener un cliente? | Sin límite; solo no puede haber dos confirmadas de la misma sala que se crucen                                                              | El enunciado no pone límite                                                                          |
| ¿Qué se valida en cada paso del borrador?             | Formato con Zod (`400`); reglas de horario, capacidad de la sala y café ≤ personas (`422` con razones). La disponibilidad solo al confirmar | Los borradores no bloquean horarios; revisar disponibilidad antes de confirmar daría falsa seguridad |
| ¿Cuándo se acuerda el precio?                         | Al confirmar: el servidor lo recalcula con el cotizador y lo guarda en la reserva; después nunca se recalcula                               | El precio de un borrador puede quedar viejo; la confirmación es el contrato                          |
| ¿Puede pasar un borrador a cancelado?                 | Sí: el cliente descarta su propio borrador (motivo automático) y el admin puede descartarlo con motivo                                      | El enunciado solo muestra cancelar desde confirmada; un borrador abandonado necesita una salida      |
| ¿Quién cancela una reserva confirmada?                | Solo el admin, con motivo obligatorio (mínimo 5 caracteres)                                                                                 | El enunciado solo define la cancelación del admin                                                    |
| ¿Quién marca una reserva como completada?             | El admin, solo cuando ya terminó (`ends_at ≤ ahora`)                                                                                        | No hay regla en el enunciado; evita un proceso programado                                            |
| Reserva de otro cliente                               | `404`, no `403`                                                                                                                             | No revelar que existe                                                                                |
| Paginación del admin                                  | Por número de página (`page`, `pageSize` ≤ 100), orden `created_at DESC, id DESC`                                                           | Suficiente a este tamaño y da "Página 2 de 3"; con millones de filas usaría cursor                   |
| Moneda                                                | Pesos enteros, mostrados como $40.000                                                                                                       | El enunciado usa COP sin decimales                                                                   |

## API

Todas las respuestas de error tienen la forma `{ error: { code, message, details? } }`: `400` formato inválido (con el campo), `401` sin sesión, `403` sin permiso, `404` no existe o no es tuya, `409` conflicto de estado o de horario, `422` regla de negocio (con las razones en español).

| Método | Ruta                               | Quién   | Descripción                                                                                                                                                |
| ------ | ---------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/api/auth/login`                  | Todos   | `{ email, password }` → `{ user }` y cookie de sesión `httpOnly`                                                                                           |
| POST   | `/api/auth/logout`                 | Todos   | Cierra la sesión                                                                                                                                           |
| GET    | `/api/auth/me`                     | Sesión  | Usuario de la sesión, o `401`                                                                                                                              |
| GET    | `/api/rooms`                       | Todos   | Salas con tamaño, capacidad y tarifa por hora                                                                                                              |
| POST   | `/api/quotes`                      | Todos   | `{ roomId, date: 'AAAA-MM-DD', startTime: 'HH:mm', durationHours, extras? }` → desglose, `bookable`, razones, horario de ese día y siguiente horario libre |
| POST   | `/api/bookings`                    | Cliente | Crea el borrador desde una cotización (o mueve el borrador abierto al nuevo horario)                                                                       |
| GET    | `/api/bookings/draft/current`      | Cliente | El borrador abierto, o `404`                                                                                                                               |
| GET    | `/api/bookings/:id`                | Cliente | Una reserva propia                                                                                                                                         |
| PATCH  | `/api/bookings/:id`                | Cliente | `{ step: 1 \| 2 \| 3, data }`: guarda un paso del asistente                                                                                                |
| POST   | `/api/bookings/:id/confirm`        | Cliente | Borrador → confirmada; congela el precio. Idempotente                                                                                                      |
| POST   | `/api/bookings/:id/cancel`         | Cliente | Descarta el borrador propio                                                                                                                                |
| GET    | `/api/admin/bookings`              | Admin   | `?status=&roomId=&page=&pageSize=` → `{ items, total, page, pageSize }`                                                                                    |
| GET    | `/api/admin/bookings/:id`          | Admin   | Detalle de cualquier reserva, con cliente y motivo de cancelación                                                                                          |
| POST   | `/api/admin/bookings/:id/cancel`   | Admin   | `{ reason }` (mínimo 5 caracteres): borrador o confirmada → cancelada                                                                                      |
| POST   | `/api/admin/bookings/:id/complete` | Admin   | Confirmada → completada, solo si ya terminó                                                                                                                |

### Estados de una reserva

```
borrador ──► confirmada ──► completada
   │             │
   └──► cancelada ◄┘
```

Completada y cancelada son finales. La máquina de estados es un mapa puro con las 16 combinaciones probadas; cada servicio pone los estados de origen permitidos en el `WHERE` del `UPDATE`, así la regla se aplica de forma atómica.

## Garantías de concurrencia

Las dos garantías que pide la prueba viven en PostgreSQL, no en revisiones en código: una revisión del tipo "¿está libre? → confirmo" tiene una condición de carrera (dos peticiones revisan al mismo tiempo, ninguna ve nada y las dos confirman).

### 1. Dos clientes confirman la misma sala y horario: solo uno gana

Restricción de exclusión en la tabla `bookings` (migración `0003`):

```sql
EXCLUDE USING gist (room_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&)
  WHERE (status IN ('confirmed', 'completed'))
```

- No pueden existir dos reservas confirmadas de la misma sala con rangos que se crucen. PostgreSQL lo verifica de forma atómica: si dos confirmaciones llegan a la vez, la segunda espera a la primera y falla con `23P01`.
- El API traduce ese error a `409 SLOT_TAKEN` con el siguiente horario libre del mismo día.
- El rango es semiabierto (`[)`): 10:00–12:00 y 12:00–14:00 no chocan.
- Los borradores no bloquean: dos personas pueden tener borradores del mismo horario; gana quien confirme primero.

### 2. El mismo cliente confirma dos veces: sin duplicado y sin recalcular el precio

La confirmación es un `UPDATE` condicional que guarda el precio en la misma sentencia:

```sql
UPDATE bookings SET status = 'confirmed', confirmed_at = now(), base = …, total = …
WHERE id = $1 AND customer_id = $2 AND status IN ('draft')
RETURNING *;
```

- Si ya estaba confirmada, el servicio devuelve la reserva guardada con su precio, sin recalcular nada (`200`, idempotente).
- Si dos confirmaciones de la misma reserva llegan a la vez, se serializan en el bloqueo de la fila: la segunda vuelve a evaluar `status IN ('draft')`, no actualiza nada y recibe la reserva ya confirmada.
- El precio se calcula en el servidor al confirmar y queda congelado en la fila (`base`, `discount`, `surcharge`, `extras_total`, `total`); después nunca se recalcula.
- La misma condición protege la máquina de estados: una confirmación tardía no puede sobrescribir una cancelación (`409 INVALID_TRANSITION`).

### Cómo se prueba

Pruebas de integración contra PostgreSQL real (`bookings.confirm.test.ts`, `bookings.cancel.test.ts`). Para que "al mismo tiempo" no dependa de la suerte, `src/test/concurrency.ts` bloquea la fila, lanza las peticiones, espera a que PostgreSQL reporte que todas están bloqueadas en su `UPDATE` y las libera juntas. Para comprobar que las pruebas detectan errores, quité a propósito la condición `status IN (…)` de la confirmación y de la cancelación: las pruebas de carrera fallaron en cada corrida.

## Correo de confirmación en segundo plano

**Cómo verlo:** confirma una reserva y abre Mailpit en http://localhost:8025. El correo llega en unos 2 segundos.

**Cómo funciona (outbox transaccional):**

1. Al confirmar, el mismo `UPDATE` que confirma la reserva y el `INSERT` en `email_outbox` van en **una sola transacción**: o existen los dos o ninguno. La petición responde sin tocar SMTP.
2. Un worker dentro del proceso del API revisa la tabla cada 2 segundos. Toma hasta 10 correos pendientes con `SELECT … FOR UPDATE SKIP LOCKED` (varios workers nunca toman el mismo), los marca `sending` con un plazo de 60 s, cierra la transacción y **envía fuera de ella** (nunca mantiene una transacción abierta durante una llamada de red).
3. Si el envío falla, reintenta con espera creciente: 5, 10, 20, 40 y 80 segundos (±20 % para no reintentar todos a la vez). "Se reintenta hasta 5 veces" = 1 intento + 5 reintentos; después queda `failed`, visible en el admin.
4. Si un worker se cae a mitad de un envío, el plazo vence y otro worker lo retoma.

**Un solo correo por reserva:** solo la petición que realmente confirmó inserta el correo, `UNIQUE (booking_id, kind)` hace imposible un segundo, y el insert usa `ON CONFLICT DO NOTHING`. Hay pruebas para confirmar dos veces, dos confirmaciones simultáneas y dos clientes compitiendo por el mismo horario.

**El límite honesto:** la entrega es "al menos una vez". Si SMTP acepta el correo y el proceso muere antes de marcarlo `sent`, se reenviará. Cada correo lleva un `Message-ID` fijo por reserva (`<booking-confirmed.{id}@lumni.local>`) que un proveedor real puede usar para descartar el duplicado. "Exactamente una vez" no se puede garantizar entre dos sistemas distintos (la base de datos y el servidor de correo).

**Para ver los reintentos en una demo:** pon `EMAIL_FAIL_FIRST_N=2` en `.env` y reinicia el API: los dos primeros envíos fallan y el tercero llega. Con `EMAIL_FAIL_FIRST_N=10` el correo termina en `failed` después de unos 2,5 minutos.

## Asistente de reservas con IA

_Pendiente (Parte 2.2), incluida la regla 4._

## Qué quedó por fuera y por qué

| Qué                                             | Por qué                                                                                                                                                                |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Festivos                                        | No están en el enunciado; requerirían una tabla de festivos. El coworking abre lunes a sábado aunque sea festivo                                                       |
| Revocar sesiones antes de que expiren           | El JWT dura 8 horas y el logout borra la cookie, pero no invalida el token en el servidor. Se resolvería con sesiones en base de datos o una lista de tokens revocados |
| Límite de intentos de login                     | Aceptable para una prueba local; en producción agregaría límite por IP y por cuenta                                                                                    |
| Paginación por cursor                           | Con este volumen la paginación por número es más simple; con millones de filas usaría cursor                                                                           |
| Dockerfiles del API y el front                  | En desarrollo corren con Node; Docker se usa para PostgreSQL y Mailpit                                                                                                 |
| Edición de la reserva confirmada por el cliente | No la pide el enunciado; solo el admin la cancela                                                                                                                      |
| Ver "mis reservas" como cliente                 | No la pide el enunciado; el cliente ve su confirmación y retoma su borrador                                                                                            |

## Bonus Rails

**El problema.** `before_save :regenerate_invoice, if: -> { status == 'confirmed' }` mira el **estado**, no la **transición**. Cada vez que se guarda una reserva ya confirmada (cambiar las notas, un job de pagos que actualiza un campo, un segundo confirm) se borra la factura emitida y se crea otra. Consecuencias, de más a menos grave:

1. **Se recalcula el precio pactado:** `lines_total` y `TaxCalculator.for(self)` se evalúan con los datos y el IVA de hoy. Rompe la regla de la Parte 1 de no recalcular un precio ya acordado.
2. **Se borra una factura emitida** y aparece otra con otro id. En Colombia una factura emitida tiene consecutivo DIAN y se anula con nota crédito; no se borra.
3. **La reserva puede quedar confirmada sin factura, sin concurrencia de por medio:** la factura nueva se guarda después de la reserva y, si es inválida, `save` devuelve `true` igual. La vieja ya se destruyó.
4. **Concurrencia:** sin índice único en `invoices.booking_id`, dos guardados simultáneos dejan dos facturas.

**La corrección.** Emitir la factura una sola vez, en la transición `draft → confirmed`, de forma idempotente, y no volver a tocarla:

```ruby
class Booking < ApplicationRecord
  has_one :invoice

  after_save :issue_invoice, if: -> { saved_change_to_status?(from: 'draft', to: 'confirmed') }

  private

  def issue_invoice
    Invoice.create_or_find_by!(booking_id: id) do |invoice|
      invoice.total = lines_total
      invoice.tax = TaxCalculator.for(self)
    end
  end
end

# migración
add_index :invoices, :booking_id, unique: true
```

- `saved_change_to_status?` es la forma correcta dentro de `after_save` (`status_changed?` ahí ya es `false`).
- `create_or_find_by!` inserta dentro de un savepoint y se apoya en el índice único: un confirm repetido o simultáneo encuentra la factura existente en vez de fallar. Un `rescue ActiveRecord::RecordNotUnique` sin savepoint no sirve en PostgreSQL: la transacción queda abortada y el COMMIT se vuelve ROLLBACK en silencio.
- `after_save` corre dentro de la transacción del guardado y `create_or_find_by!` lanza error si la factura es inválida, así que la reserva no queda confirmada sin factura.
- Quito `dependent: :destroy`: una reserva con factura emitida se cancela, no se borra.

En un código real preferiría un servicio explícito (`Booking#confirm!`), igual que el confirm de la Parte 1, en lugar de un callback.

**Cómo lo verifiqué.** `bonus_rails/verify.rb` corre los dos modelos contra ActiveRecord 8.0.2 y PostgreSQL reales (16 comprobaciones). Reproduce los cuatro problemas, muestra que la corrección emite una sola factura aunque cambie el IVA o se confirme dos veces, y que dos "correcciones" tentadoras fallan (`status_changed?` en `after_save` nunca dispara; `rescue RecordNotUnique` hace que `save` devuelva `true` sin guardar nada). Al romper la corrección a propósito aprendí algo: lo que de verdad evita la factura duplicada es el índice único con `create_or_find_by!`; la condición de transición evita trabajo y deja clara la intención. La concurrencia se simula con dos instancias desactualizadas, no con hilos reales.

```bash
docker compose exec postgres createdb -U lumni rails_bonus
DATABASE_URL=postgres://lumni:lumni@localhost:5433/rails_bonus ruby bonus_rails/verify.rb
```

Requiere Ruby 3.2 o superior; instala `activerecord` y `pg` la primera vez.

## Uso de IA

**Herramienta:** Claude (Anthropic), como agente con acceso a la carpeta del repositorio. Las instrucciones del proyecto están en [`CLAUDE.md`](CLAUDE.md).

**En qué partes:** en todas. La IA propuso el plan por pasos, escribió las pruebas primero (TDD) y luego el código, y redactó la documentación. Yo aprobé cada paso, corrí las pruebas en mi máquina e hice cada commit. Decisiones que tomé yo: TDD también en el frontend, el indicador de carga, renombrar `subtotal` a `base`, una sola reserva en borrador por cliente garantizada por la base, y commits pequeños.

**Lo que la IA propuso y corregimos:**

1. **Una prueba de concurrencia que pasaba por suerte.** La primera versión lanzaba dos confirmaciones con `Promise.all`. Al quitar a propósito la protección contra doble reserva, la prueba seguía pasando: las dos peticiones casi nunca coincidían. La reemplazamos por `releaseTogether`, que bloquea la fila y espera en `pg_stat_activity` a que ambas peticiones estén realmente esperando antes de soltarlas. Ahora romper la protección hace fallar la prueba siempre.
2. **Un enrutador que fallaba en mi máquina.** La IA usó el modo de datos de React Router (`createMemoryRouter`). En su entorno (Node 22) las pruebas pasaban; en mi Mac (Node 24) fallaban con `Expected signal to be an instance of AbortSignal`. Lo reprodujimos con Node 24 y pasamos al modo declarativo. Desde entonces corro la suite en Node 22 y 24.
3. **Dos relojes distintos.** Reintentar un correo fallido usaba el reloj de la aplicación, pero el worker que lo procesa usa `now()` de la base. Cambiamos el reintento a `now()` de la base para que ambos midan el mismo tiempo.
4. **Una hipótesis equivocada en el incidente.** El primer plan de `INCIDENTE.md` decía que fallaban los recordatorios creados después de las 16:00. Al compararlo con un segundo plan vi que 16:00–17:30 sigue dentro de la ventana, y que el 92 % no es una tasa porque no tiene denominador. Lo corregí antes de escribirlo.
5. **Qué protege de verdad en el bonus Rails.** Al romper la corrección a propósito, la condición de transición resultó no ser lo que evita la factura duplicada: es el índice único. Lo dejé escrito así.
6. **Variables de entorno sin validar.** Al preguntarle cómo manejar `.env`, la IA revisó su propio código: `PORT` y `EMAIL_FAIL_FIRST_N` pasaban por `Number()` sin validar, así que un error de tipeo se volvía `NaN` en silencio. Le pedí validar todo el entorno al arrancar con Zod y rechazar el `JWT_SECRET` de ejemplo en producción. Comprobamos que las pruebas fallan si se quita cualquiera de las dos reglas.

**Qué verifiqué yo:** la suite completa (pruebas de API contra PostgreSQL real y de frontend) en mi máquina antes de cada commit; las pruebas de concurrencia y de idempotencia rompiendo el código a propósito; la interfaz con capturas en escritorio y móvil; los correos y sus reintentos en Mailpit; y el bonus Rails corriendo `bonus_rails/verify.rb`.
