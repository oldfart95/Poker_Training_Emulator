import { ActionKind } from '../types';
import { BoardBucket } from '../buckets/boardBuckets';
import { HandBucket } from '../buckets/handBuckets';

export const postflopPolicies: Record<BoardBucket, Record<HandBucket, Record<ActionKind, number>>> = {
  'a-high-dry': {
    'nuts-near-nuts': { fold: 0, check: 0.1, call: 0.2, raise: 0.65, all_in: 0.05 },
    'strong-value': { fold: 0, check: 0.24, call: 0.26, raise: 0.5, all_in: 0 },
    'medium-value': { fold: 0.1, check: 0.45, call: 0.3, raise: 0.15, all_in: 0 },
    'weak-showdown': { fold: 0.2, check: 0.48, call: 0.26, raise: 0.06, all_in: 0 },
    'strong-draw': { fold: 0.08, check: 0.25, call: 0.35, raise: 0.32, all_in: 0 },
    'weak-draw': { fold: 0.18, check: 0.28, call: 0.36, raise: 0.18, all_in: 0 },
    'bluff-blockers': { fold: 0.3, check: 0.3, call: 0.08, raise: 0.32, all_in: 0 },
    'bluff-no-blockers': { fold: 0.42, check: 0.38, call: 0.1, raise: 0.1, all_in: 0 },
    air: { fold: 0.48, check: 0.38, call: 0.08, raise: 0.06, all_in: 0 }
  },
  'k-high-dry': {} as any,
  'paired-dry': {} as any,
  'low-connected-wet': {} as any,
  'middling-two-tone': {} as any,
  monotone: {} as any,
  'broadway-dynamic': {} as any,
  'low-disconnected': {} as any
};

for (const key of ['k-high-dry','paired-dry','middling-two-tone','low-disconnected'] as BoardBucket[]) {
  postflopPolicies[key] = { ...postflopPolicies['a-high-dry'] };
}
postflopPolicies['low-connected-wet'] = {
  ...postflopPolicies['a-high-dry'],
  'bluff-no-blockers': { fold: 0.55, check: 0.33, call: 0.08, raise: 0.04, all_in: 0 },
  'strong-draw': { fold: 0.04, check: 0.14, call: 0.36, raise: 0.46, all_in: 0 }
};
postflopPolicies.monotone = {
  ...postflopPolicies['a-high-dry'],
  'medium-value': { fold: 0.2, check: 0.45, call: 0.3, raise: 0.05, all_in: 0 },
  'bluff-blockers': { fold: 0.34, check: 0.32, call: 0.08, raise: 0.26, all_in: 0 }
};
postflopPolicies['broadway-dynamic'] = {
  ...postflopPolicies['a-high-dry'],
  'strong-draw': { fold: 0.03, check: 0.18, call: 0.33, raise: 0.46, all_in: 0 },
  air: { fold: 0.52, check: 0.32, call: 0.06, raise: 0.1, all_in: 0 }
};
