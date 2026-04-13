import { Card, HandResult } from './types';
import { rankValue } from './deck';

const byDesc = (a:number,b:number) => b-a;

const countRanks = (cards: Card[]) => {
  const map = new Map<number, number>();
  cards.forEach((c) => map.set(rankValue(c.rank), (map.get(rankValue(c.rank)) ?? 0) + 1));
  return map;
};

const detectStraight = (values: number[]): number | null => {
  const uniq = [...new Set(values)].sort(byDesc);
  if (uniq.includes(14)) uniq.push(1);
  for (let i = 0; i <= uniq.length - 5; i++) {
    if (uniq[i] - uniq[i + 4] === 4) return uniq[i];
  }
  return null;
};

export const evaluateBestHand = (cards: Card[]): HandResult => {
  const suits = new Map<string, Card[]>();
  cards.forEach((c) => {
    suits.set(c.suit, [...(suits.get(c.suit) ?? []), c]);
  });
  const values = cards.map((c) => rankValue(c.rank));
  const rankCounts = [...countRanks(cards).entries()].sort((a,b) => b[1]-a[1] || b[0]-a[0]);

  let flushCards: Card[] | null = null;
  suits.forEach((suitCards) => {
    if (suitCards.length >= 5) flushCards = suitCards;
  });

  if (flushCards) {
    const straightFlushHigh = detectStraight(flushCards.map((c) => rankValue(c.rank)));
    if (straightFlushHigh) return { rankName: 'Straight Flush', score: [8, straightFlushHigh] };
  }

  if (rankCounts[0][1] === 4) {
    const kicker = values.filter((v) => v !== rankCounts[0][0]).sort(byDesc)[0];
    return { rankName: 'Four of a Kind', score: [7, rankCounts[0][0], kicker] };
  }

  if (rankCounts[0][1] === 3 && rankCounts[1]?.[1] >= 2) {
    return { rankName: 'Full House', score: [6, rankCounts[0][0], rankCounts[1][0]] };
  }

  if (flushCards) {
    const high = flushCards.map((c) => rankValue(c.rank)).sort(byDesc).slice(0,5);
    return { rankName: 'Flush', score: [5, ...high] };
  }

  const straightHigh = detectStraight(values);
  if (straightHigh) return { rankName: 'Straight', score: [4, straightHigh] };

  if (rankCounts[0][1] === 3) {
    const kickers = values.filter((v) => v !== rankCounts[0][0]).sort(byDesc).slice(0,2);
    return { rankName: 'Three of a Kind', score: [3, rankCounts[0][0], ...kickers] };
  }

  if (rankCounts[0][1] === 2 && rankCounts[1]?.[1] === 2) {
    const pairs = [rankCounts[0][0], rankCounts[1][0]].sort(byDesc);
    const kicker = values.filter((v) => v !== pairs[0] && v !== pairs[1]).sort(byDesc)[0];
    return { rankName: 'Two Pair', score: [2, ...pairs, kicker] };
  }

  if (rankCounts[0][1] === 2) {
    const kickers = values.filter((v) => v !== rankCounts[0][0]).sort(byDesc).slice(0,3);
    return { rankName: 'Pair', score: [1, rankCounts[0][0], ...kickers] };
  }

  return { rankName: 'High Card', score: [0, ...values.sort(byDesc).slice(0,5)] };
};

export const compareHands = (a: HandResult, b: HandResult): number => {
  const len = Math.max(a.score.length, b.score.length);
  for (let i = 0; i < len; i++) {
    const av = a.score[i] ?? 0;
    const bv = b.score[i] ?? 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
};
