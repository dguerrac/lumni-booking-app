# Lumni Coworking · Reservas de salas

Prueba técnica Lumni TI. Monorepo TypeScript: React + Express + PostgreSQL.

## Cómo correrlo localmente

Requisitos: Node 20.11+ (ver `.nvmrc`), Docker.

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

Pruebas: `npm test`

## Usuarios de prueba

_Pendiente (paso 1)._

## Arquitectura

_Pendiente._

## Decisiones

_Pendiente: tabla de ambigüedades y decisiones._

## Garantías de concurrencia

_Pendiente: doble reserva del mismo horario y doble confirmación de la misma reserva._

## Correo de confirmación en segundo plano

_Pendiente (Parte 2.1)._

## Asistente de reservas con IA

_Pendiente (Parte 2.2), incluida la regla 4._

## Qué quedó por fuera y por qué

_Pendiente._

## Uso de IA

_Pendiente: herramienta, en qué partes, un ejemplo corregido o descartado, qué verifiqué yo._
