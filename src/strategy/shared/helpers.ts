import { ActionKind } from '../types';

export const normalizeWeights = (weights: Record<ActionKind, number>): Record<ActionKind, number> => {
  const total = Object.values(weights).reduce((sum, value) => sum + Math.max(0, value), 0);
  if (total <= 0) return { fold: 0.2, check: 0.2, call: 0.2, raise: 0.2, 'all-in': 0.2 };
  return Object.fromEntries(Object.entries(weights).map(([key, value]) => [key, Math.max(0, value) / total])) as Record<ActionKind, number>;
};

export const weightedChoice = (weights: Record<ActionKind, number>): ActionKind => {
  const normalized = normalizeWeights(weights);
  let roll = Math.random();
  for (const [key, value] of Object.entries(normalized) as [ActionKind, number][]) {
    roll -= value;
    if (roll <= 0) return key;
  }
  return 'check';
};

export const sizeFromPolicy = (pot: number, minRaise: number, stack: number, boardBucket: string): number => {
  const pct = boardBucket.includes('wet') || boardBucket.includes('dynamic') ? 0.72 : boardBucket.includes('dry') ? 0.36 : 0.52;
  return Math.min(stack, Math.max(minRaise, Math.round(pot * pct)));
};
