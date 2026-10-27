import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { InvalidTransitionError } from '../modules/bookings/domain/state-machine';

/** An expected failure with a stable code the client can rely on. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export class NotFoundError extends AppError {
  constructor(code: string, message: string) {
    super(404, code, message);
  }
}

export const notFoundHandler: RequestHandler = () => {
  throw new NotFoundError('ROUTE_NOT_FOUND', 'La ruta no existe.');
};

/** Every error leaves the API as { error: { code, message, details? } }. */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Los datos enviados no son válidos.',
        details: err.issues,
      },
    });
    return;
  }

  if (err instanceof AppError) {
    const { status, code, message, details } = err;
    res
      .status(status)
      .json({ error: details === undefined ? { code, message } : { code, message, details } });
    return;
  }

  if (err instanceof InvalidTransitionError) {
    res.status(409).json({ error: { code: 'INVALID_TRANSITION', message: err.message } });
    return;
  }

  // Thrown by express.json() when the body can't be parsed.
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({
      error: { code: 'MALFORMED_JSON', message: 'El cuerpo de la petición no es JSON válido.' },
    });
    return;
  }

  console.error(err);
  res
    .status(500)
    .json({ error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor.' } });
};
