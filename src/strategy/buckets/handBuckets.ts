import { Card } from '../../engine/types';
import { categorizeHand } from '../../ai/tuning/handBuckets';

export type HandBucket =
  | 'nuts-near-nuts'
  | 'strong-value'
  | 'medium-value'
  | 'weak-showdown'
  | 'strong-draw'
  | 'weak-draw'
  | 'bluff-blockers'
  | 'bluff-no-blockers'
  | 'air';

export const classifyHandBucket = (cards: Card[], board: Card[]): HandBucket => {
  const base = categorizeHand(cards, board);
  if (base === 'monster') return 'nuts-near-nuts';
  if (base === 'strong-made') return 'strong-value';
  if (base === 'medium-made') return 'medium-value';
  if (base === 'weak-showdown') return 'weak-showdown';
  if (base === 'strong-draw') return 'strong-draw';
  if (base === 'weak-draw') return 'weak-draw';

  const blockers = cards.filter((c) => c.rank === 'A' || c.rank === 'K' || c.rank === 'Q').length;
  if (base === 'air') return blockers >= 1 ? 'bluff-blockers' : 'bluff-no-blockers';
  return 'air';
};
