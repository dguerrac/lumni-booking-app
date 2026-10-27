import { z } from 'zod';

// The value shipped in .env.example. Fine for local development, never for production.
const PLACEHOLDER_SECRET = 'change-me-to-a-long-random-string';
const MIN_PRODUCTION_SECRET_LENGTH = 32;

const port = z.coerce.number().int().min(1).max(65_535);

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: port.default(3000),
    DATABASE_URL: z.string().url(),
    JWT_SECRET: z.string().min(1),
    SMTP_HOST: z.string().min(1),
    SMTP_PORT: port,
    EMAIL_FROM: z.string().min(1),
    EMAIL_FAIL_FIRST_N: z.coerce.number().int().min(0).default(0),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    if (env.JWT_SECRET === PLACEHOLDER_SECRET || env.JWT_SECRET.length < MIN_PRODUCTION_SECRET_LENGTH) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_SECRET'],
        message: `must be a random value of at least ${MIN_PRODUCTION_SECRET_LENGTH} characters in production`,
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

/** Validates the whole environment at once, so startup reports every problem together. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (result.success) return result.data;

  const problems = result.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`);
  throw new Error(`Invalid environment variables:\n${problems.join('\n')}\nSee .env.example.`);
}

/** For values outside the app config, like TEST_DATABASE_URL in tests. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}. See .env.example.`);
  return value;
}
