# Incidente: recordatorios de WhatsApp que nunca llegan

Sin logs ni código a la vista, todo lo que sigue es hipótesis con la evidencia que la confirmaría o la descartaría.

## 1. Hipótesis y cómo confirmarla

**Hipótesis:** la expiración cuenta horas en las que está prohibido escribir. Supuestos: el job corre a las :00 y :30 y fuera de 8:00–18:00 (Bogotá) no envía.

```
17:40 creado (pending) · 18:00 fuera de ventana, no envía · 20:00 lleva 2 h 20 → expired · 08:00 ya no se reintenta
```

**Qué dicen los datos y qué no.** La hipótesis predice que expiran los creados entre ~17:30 y ~6:00. El 92 % es consistente, pero es una proporción _de los expirados_, sin denominador: si casi todos los borradores se crean en la tarde, saldría algo parecido con una tasa pareja. Y uno creado a las 17:00 aún alcanza la corrida de las 17:30; si esos también expiran, hay algo más.

| Alternativa              | Qué la distingue                                                              |
| ------------------------ | ----------------------------------------------------------------------------- |
| Ventana evaluada en UTC  | La tasa salta en otra hora, no a las 18:00 de Bogotá; revisar `TZ` del worker |
| Fallas del proveedor     | Expirados con intentos y respuestas de error                                  |
| El job se salta corridas | Huecos en sus logs; `pending` envejeciendo en horario permitido               |
| Filtro de elegibilidad   | `pending` en horario permitido sin intento ni motivo de salto                 |

**Qué reviso, en orden:**

1. Tasa de expiración (expirados ÷ creados) por franja de 30 min de creación, en hora de Bogotá:
   ```sql
   SELECT date_bin('30 min', created_at AT TIME ZONE 'America/Bogota', '2000-01-01') AS franja,
          count(*) AS creados,
          round(100.0 * count(*) FILTER (WHERE status = 'expired') / count(*), 1) AS pct_expirados
   FROM reminders WHERE created_at >= now() - interval '30 days'
   GROUP BY 1 ORDER BY 1;
   ```
2. La línea de tiempo de una muestra de expirados: cada corrida, decisión (con motivo de salto), intento y respuesta del proveedor. "Nunca se intentó" y "se intentó y falló" son causas distintas.
3. Logs de ejecución del job, `TZ` del proceso y el código de la ventana.
4. Reproducirlo con reloj congelado: creado 17:40, `expired` en la corrida de las 20:00.

## 2. Corregir los registros afectados

Primero, qué es "enviado": **despachado**, **aceptado** por el proveedor o **entregado** (webhook). Que nuestra tabla diga "no enviado" no prueba que no salió: la respuesta pudo perderse. Concilio con la API o los webhooks del proveedor; lo incierto se excluye, nunca se reenvía a ciegas.

1. **Desplegar antes el arreglo de fondo** (sección 3), o los recuperados vuelven a expirar.
2. **Seleccionar candidatos** (solo lectura) en una tabla con `recovery_batch_id`: `expired`, reserva todavía en `draft` con horario futuro, cliente sin baja, sin despacho previo para esa reserva. **Uno por cliente**, garantizado con `UNIQUE (recovery_batch_id, customer_id)`.
3. **Reencolar actualizando la fila** (`expired → pending`), nunca insertando otra, con `send_after` = siguiente momento en ventana; lotes repartidos en la mañana.
4. **Despachar en dos transacciones cortas**, el mismo patrón del outbox de correos de la Parte 2.1:
   - _Reclamar_ con `FOR UPDATE SKIP LOCKED` y `FOR SHARE` sobre la reserva; revalidar (sigue en `draft`, en ventana, sin despacho) y pasar a `sending`. Así una confirmación no se cuela entre la revisión y el cambio.
   - _Llamar_ al proveedor fuera de toda transacción, con llave de idempotencia si la soporta.
   - _Registrar_ `sent`, `failed` o `unknown`; lo `unknown` se concilia, no se reintenta.
   - Riesgo aceptado: alguien confirma justo después del reclamo. El texto dice "si ya confirmaste, ignora este mensaje".
5. **Interruptor y reversa:** el interruptor detiene el worker; la reversa devuelve a `expired` solo las filas del lote aún en `pending`. Lo despachado se conserva: es lo que evita duplicados.

**Pruebas:** reloj congelado a las 7:59, 8:00, 17:59, 18:00 y 3:00; una confirmación compitiendo con un despacho; un timeout del proveedor que termina en `unknown`. Luego staging con copia anonimizada y proveedor simulado: el ensayo en seco verifica cero confirmadas, cero ya contactados y máximo uno por cliente. En producción: ensayo en seco, canario de ~10, revisar entregas, resto por lotes.

**Aprobaciones:** otro ingeniero revisa script y consultas; el dueño de negocio decide si recontactar, hasta qué fecha y con qué texto; cumplimiento valida plantilla y consentimiento de WhatsApp; ejecuta quien esté de turno.

## 3. Cambio de fondo y detección temprana

- Calcular `send_after` al crear el recordatorio: el primer momento en ventana, con una sola función probada `isWithinSendingWindow(now, tz)`.
- **Expirar tras 2 horas de horario permitido**, contadas desde `send_after`: lo más cercano a la intención actual. La alternativa, que decide negocio, es expirar por condiciones (la reserva deja de ser borrador o su horario pasa).
- Estados de despacho (`pending → sending → sent | failed | unknown`), llave de idempotencia y auditoría de cada transición.

**Detección:** una alerta en vivo cuando un recordatorio espera más de N minutos _en horario permitido_ (habría sonado el primer día); la tasa de expiración por cohorte y franja de creación; y la métrica de negocio: porcentaje de borradores elegibles con recordatorio aceptado dentro de N horas permitidas.

## 4. Mensaje al equipo comercial

Se envía cuando la causa esté confirmada; antes, la primera línea dice "estamos confirmando la causa".

> Encontramos la causa: los recordatorios de reservas dejadas al final de la tarde o en la noche caducaban antes de las 8 a. m., la primera hora en que podemos escribir.
> La corrección sale el [día]; desde entonces esos recordatorios se envían a primera hora.
> A los clientes afectados que siguen sin confirmar les escribiremos una sola vez; necesitamos su visto bueno al texto y a hasta qué fecha contactamos.
> El [día] les contamos cuántas reservas recuperamos. Gracias por avisarnos.
