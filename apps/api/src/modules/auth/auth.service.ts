import type { LoginRequest, UserDto } from '@lumni/shared';
import bcrypt from 'bcryptjs';
import type { Kysely } from 'kysely';
import type { Database } from '../../db/types';
import { AppError } from '../../http/errors';
import { findUserByEmail, findUserById } from './auth.repository';

// Compared against when the email doesn't exist, so a wrong email takes as long
// as a wrong password and response times don't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

const invalidCredentials = () =>
  new AppError(401, 'INVALID_CREDENTIALS', 'Correo o contraseña incorrectos.');

export async function login(db: Kysely<Database>, input: LoginRequest): Promise<UserDto> {
  const user = await findUserByEmail(db, input.email);
  const passwordOk = await bcrypt.compare(input.password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !passwordOk) throw invalidCredentials();

  const { password_hash: _hash, ...publicUser } = user;
  return publicUser;
}

export async function getCurrentUser(db: Kysely<Database>, userId: number): Promise<UserDto> {
  const user = await findUserById(db, userId);
  if (!user) throw new AppError(401, 'UNAUTHENTICATED', 'Inicia sesión para continuar.');
  return user;
}
