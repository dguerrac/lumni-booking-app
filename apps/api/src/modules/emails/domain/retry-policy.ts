// "Se reintenta hasta 5 veces con espera creciente": 1 attempt + 5 retries.
// Short demo values so a full failure plays out in about 2.5 minutes; in
// production the base would be minutes and the cap hours.
export const MAX_ATTEMPTS = 6;
const BASE_DELAY_SECONDS = 5;
const JITTER = 0.2;

/**
 * Seconds to wait after failed attempt number `attempt` (1-based): 5, 10, 20,
 * 40, 80, each ±20 %. The jitter spreads out emails that failed at the same
 * moment (for example, the mail server was down), so they don't all retry
 * together. `random` is injectable to make tests exact.
 */
export function retryDelaySeconds(attempt: number, random: () => number = Math.random): number {
  const base = BASE_DELAY_SECONDS * 2 ** (attempt - 1);
  const factor = 1 - JITTER + random() * 2 * JITTER;
  return Math.round(base * factor);
}

export type AfterFailure = { status: 'retrying'; nextAttemptAt: Date } | { status: 'failed' };

/** What happens to an email after its `attempts`-th attempt failed. */
export function afterFailure({
  attempts,
  now,
  random,
}: {
  attempts: number;
  now: Date;
  random?: () => number;
}): AfterFailure {
  if (attempts >= MAX_ATTEMPTS) return { status: 'failed' };
  return {
    status: 'retrying',
    nextAttemptAt: new Date(now.getTime() + retryDelaySeconds(attempts, random) * 1000),
  };
}
