import { describe, expect, it } from 'vitest';
import { afterFailure, MAX_ATTEMPTS, retryDelaySeconds } from './retry-policy';

const noJitter = () => 0.5; // random() = 0.5 → jitter factor exactly 1

describe('retryDelaySeconds', () => {
  it.each([
    [1, 5],
    [2, 10],
    [3, 20],
    [4, 40],
    [5, 80],
  ])('after failed attempt %i waits %i s (doubling from 5 s)', (attempt, seconds) => {
    expect(retryDelaySeconds(attempt, noJitter)).toBe(seconds);
  });

  it('spreads retries by ±20 % so emails that failed together do not retry together', () => {
    expect(retryDelaySeconds(3, () => 0)).toBe(16);
    expect(retryDelaySeconds(3, () => 1)).toBe(24);
  });
});

describe('afterFailure', () => {
  const now = new Date('2026-11-02T13:00:00.000Z');

  it('schedules a retry while there are attempts left', () => {
    expect(afterFailure({ attempts: 2, now, random: noJitter })).toEqual({
      status: 'retrying',
      nextAttemptAt: new Date('2026-11-02T13:00:10.000Z'),
    });
  });

  it(`gives up after ${MAX_ATTEMPTS} attempts: the first one plus 5 retries`, () => {
    expect(MAX_ATTEMPTS).toBe(6);
    expect(afterFailure({ attempts: 5, now, random: noJitter }).status).toBe('retrying');
    expect(afterFailure({ attempts: 6, now, random: noJitter })).toEqual({ status: 'failed' });
  });
});
