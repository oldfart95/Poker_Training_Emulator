import { handToKey, inRange } from '../../ai/tuning/ranges';
import { classifyBoardBucket } from '../buckets/boardBuckets';
import { classifyHandBucket } from '../buckets/handBuckets';
import { postflopPolicies } from '../policyTables/postflopPolicies';
import { preflopPolicyTables } from '../policyTables/preflopPolicies';
import { normalizeWeights, sizeFromPolicy, weightedChoice } from '../shared/helpers';
import { StrategyContext, StrategyDebug } from '../types';

export const decideBlueprintAction = (ctx: StrategyContext): { type: 'fold' | 'check' | 'call' | 'raise' | 'all_in'; amount: number; debug: StrategyDebug } => {
  const handKey = handToKey(ctx.cards);
  const handBucket = classifyHandBucket(ctx.cards, ctx.board);
  const boardBucket = classifyBoardBucket(ctx.board);
  let weights = { fold: 0.01, check: 0.01, call: 0.01, raise: 0.01, all_in: 0.001 };
  const notes: string[] = [];

  if (ctx.street === 'preflop') {
    const row = preflopPolicyTables[ctx.position];
    if (ctx.toCall === 0) {
      weights.raise += row.openRaise;
      weights.check += 1 - row.openRaise;
      notes.push('Preflop open-raise table used.');
    } else if (ctx.facingThreeBet) {
      weights.fold += 1 - row.continueVsThreeBet;
      weights.call += row.continueVsThreeBet * 0.68;
      weights.raise += row.continueVsThreeBet * 0.26;
      notes.push('Continue-vs-3bet baseline policy used.');
    } else {
      weights.call += row.defendVsOpen;
      weights.raise += row.threeBetVsOpen;
      weights.fold += Math.max(0.05, 1 - row.defendVsOpen - row.threeBetVsOpen);
      notes.push('Defend-vs-open + 3bet policy mix used.');
    }

    if (ctx.position === 'BB' && ctx.toCall > 0) {
      weights.call += row.blindDefense;
      notes.push('Blind defense frequency applied.');
    }

    if (!inRange(ctx.cards, new Set(['AA','KK','QQ','AKs'])) && ctx.facingThreeBet) weights.all_in = 0;
  } else {
    const policy = postflopPolicies[boardBucket][handBucket];
    weights = { ...policy };
    if (ctx.playersInHand >= 3) {
      weights.raise *= 0.85;
      weights.check += 0.08;
      notes.push('Multiway damping adjustment applied.');
    }
    if (ctx.toCall > 0 && handBucket.includes('bluff')) {
      weights.fold += 0.08;
      notes.push('Small runtime realism adjustment versus aggression.');
    }
  }

  const policyWeights = normalizeWeights(weights);
  const selected = weightedChoice(policyWeights);
  const type = selected === 'check' && !ctx.canCheck ? 'call' : selected;
  const amount = type === 'raise' ? sizeFromPolicy(ctx.pot, ctx.minRaise, ctx.stack, boardBucket) : type === 'all_in' ? ctx.stack : type === 'call' ? ctx.toCall : 0;

  return {
    type,
    amount,
    debug: {
      mode: 'blueprint',
      archetype: ctx.archetype,
      handKey,
      handBucket,
      boardBucket,
      policyWeights,
      adjustments: notes,
      reason: 'Blueprint abstraction: board bucket + hand bucket policy lookup.'
    }
  };
};
