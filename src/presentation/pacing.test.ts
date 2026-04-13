import { describe, expect, it } from 'vitest';
import { jitterInRange, paceProfiles } from './pacing';

describe('pacing profiles', () => {
  it('keeps normal think timings inside configured range', () => {
    const sample = jitterInRange(paceProfiles.Normal.thinkMs);
    expect(sample).toBeGreaterThanOrEqual(paceProfiles.Normal.thinkMs[0]);
    expect(sample).toBeLessThanOrEqual(paceProfiles.Normal.thinkMs[1]);
  });

  it('study mode is slower than fast mode on showdown', () => {
    expect(paceProfiles.Study.showdownMs[0]).toBeGreaterThan(paceProfiles.Fast.showdownMs[0]);
  });
});
