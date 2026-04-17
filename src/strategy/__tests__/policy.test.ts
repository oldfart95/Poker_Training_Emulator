import { describe, expect, it } from 'vitest';
import { preflopPolicyTables } from '../policyTables/preflopPolicies';
import { postflopPolicies } from '../policyTables/postflopPolicies';
import { applyExploitAdjustments } from '../adjustments/exploitAdjustments';

describe('strategy policy tables and exploit adjustments', () => {
  it('has open raise policy by position', () => {
    expect(preflopPolicyTables.BTN.openRaise).toBeGreaterThan(preflopPolicyTables.UTG.openRaise);
  });

  it('looks up postflop policy bucket', () => {
    const row = postflopPolicies['a-high-dry']['strong-value'];
    expect(row.raise).toBeGreaterThan(0.3);
  });

  it('reduces station bluff raises in exploit mode', () => {
    const { adjusted, notes } = applyExploitAdjustments(
      { fold: 0.2, check: 0.2, call: 0.1, raise: 0.5, all_in: 0 },
      'Calling Station',
      'bluff-no-blockers',
      true
    );
    expect(adjusted.raise).toBeLessThan(0.5);
    expect(notes.join(' ')).toContain('Reduced bluff frequency');
  });
});
