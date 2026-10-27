import { z } from 'zod';
import type { UserRole } from './index';

export const loginRequestSchema = z
  .object({
    email: z.string().trim().toLowerCase().email('Escribe un correo válido.'),
    password: z.string().min(1, 'Escribe tu contraseña.'),
  })
  .strict();

export type LoginRequest = z.infer<typeof loginRequestSchema>;

/** The logged-in user, as the API returns it. Used to prefill wizard step 1. */
export type UserDto = {
  id: number;
  email: string;
  name: string;
  phone: string | null;
  company: string | null;
  role: UserRole;
};
