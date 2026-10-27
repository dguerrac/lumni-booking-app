import { readFileSync } from 'node:fs';
import { parseEnv as parseDotenv } from 'node:util';
import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

const exampleFile = new URL('../../../../.env.example', import.meta.url);
const example = () => parseDotenv(readFileSync(exampleFile, 'utf8'));

const LONG_SECRET = 'x'.repeat(32);

describe('parseEnv', () => {
  it('accepts .env.example as is, so a fresh clone runs without edits', () => {
    const env = parseEnv(example());

    expect(env.PORT).toBe(3000);
    expect(env.SMTP_PORT).toBe(1025);
    expect(env.EMAIL_FAIL_FIRST_N).toBe(0);
  });

  it('uses defaults for PORT and EMAIL_FAIL_FIRST_N when they are missing', () => {
    const { PORT: _port, EMAIL_FAIL_FIRST_N: _failN, ...rest } = example();

    const env = parseEnv(rest);

    expect(env.PORT).toBe(3000);
    expect(env.EMAIL_FAIL_FIRST_N).toBe(0);
  });

  it('reports every missing variable in one error', () => {
    const { DATABASE_URL: _db, JWT_SECRET: _jwt, SMTP_HOST: _smtp, ...rest } = example();

    const error = captureError(() => parseEnv(rest));

    expect(error).toMatch(/DATABASE_URL/);
    expect(error).toMatch(/JWT_SECRET/);
    expect(error).toMatch(/SMTP_HOST/);
    expect(error).toMatch(/\.env\.example/);
  });

  it.each([
    ['PORT', 'abc'],
    ['SMTP_PORT', '10x25'],
    ['EMAIL_FAIL_FIRST_N', '-1'],
    ['EMAIL_FAIL_FIRST_N', 'two'],
  ])('rejects %s=%s instead of turning it into NaN or a negative count', (name, value) => {
    expect(() => parseEnv({ ...example(), [name]: value })).toThrow(name);
  });

  describe('JWT_SECRET in production', () => {
    const production = (secret: string) => ({ ...example(), NODE_ENV: 'production', JWT_SECRET: secret });

    it('rejects the placeholder from .env.example', () => {
      expect(() => parseEnv(production(example().JWT_SECRET!))).toThrow(/JWT_SECRET/);
    });

    it('rejects a secret shorter than 32 characters', () => {
      expect(() => parseEnv(production('x'.repeat(31)))).toThrow(/JWT_SECRET/);
    });

    it('accepts a secret of 32 characters or more', () => {
      expect(parseEnv(production(LONG_SECRET)).JWT_SECRET).toBe(LONG_SECRET);
    });
  });

  it('allows the placeholder secret outside production', () => {
    expect(() => parseEnv({ ...example(), NODE_ENV: 'development' })).not.toThrow();
  });
});

function captureError(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    return String(error);
  }
  throw new Error('Expected an error');
}
