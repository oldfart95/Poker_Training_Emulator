import { Card } from '../../engine/types';
import { evaluateBestHand } from '../../engine/handEvaluator';
import { rankValue } from '../../engine/deck';

export type HandBucket = 'monster'|'strong-made'|'medium-made'|'weak-showdown'|'strong-draw'|'weak-draw'|'air';

const hasFlushDraw = (cards: Card[]): boolean => {
  const suits = new Map<string, number>();
  cards.forEach((c) => suits.set(c.suit, (suits.get(c.suit) ?? 0) + 1));
  return Math.max(...suits.values()) >= 4;
};

const hasStraightDraw = (cards: Card[]): boolean => {
  const vals = [...new Set(cards.map((c) => rankValue(c.rank)).sort((a,b)=>a-b))];
  for (let i = 0; i < vals.length - 3; i++) {
    if (vals[i + 3] - vals[i] <= 4) return true;
  }
  return false;
};

export const categorizeHand = (holeCards: Card[], board: Card[]): HandBucket => {
  if (board.length === 0) return 'weak-showdown';
  const hand = evaluateBestHand([...holeCards, ...board]);
  if (['Straight Flush','Four of a Kind','Full House'].includes(hand.rankName)) return 'monster';
  if (['Flush','Straight','Three of a Kind'].includes(hand.rankName)) return 'strong-made';
  if (hand.rankName === 'Two Pair') return 'medium-made';
  if (hand.rankName === 'Pair') {
    const topBoard = Math.max(...board.map((c) => rankValue(c.rank)));
    const topPair = holeCards.some((c) => rankValue(c.rank) >= topBoard);
    return topPair ? 'medium-made' : 'weak-showdown';
  }

  const drawCards = [...holeCards, ...board];
  if (hasFlushDraw(drawCards) && hasStraightDraw(drawCards)) return 'strong-draw';
  if (hasFlushDraw(drawCards) || hasStraightDraw(drawCards)) return 'weak-draw';

  const overcards = holeCards.filter((c) => rankValue(c.rank) > Math.max(...board.map((b) => rankValue(b.rank)))).length;
  return overcards === 2 ? 'weak-draw' : 'air';
};
