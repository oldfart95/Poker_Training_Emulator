import { Card } from '../../engine/types';
import { rankValue } from '../../engine/deck';

export type Position = 'UTG'|'HJ'|'CO'|'BTN'|'SB'|'BB';
export type RangeSpot = 'openRaise'|'flatVsOpen'|'threeBetVsOpen'|'fourBetContinue'|'blindDefense'|'continueVsThreeBet';

const order = ['A','K','Q','J','T','9','8','7','6','5','4','3','2'] as const;

const expandDashRange = (token: string): string[] => {
  const [start, end] = token.split('-');
  if (!end) return [token];
  if (/^[2-9TJQKA]{2}$/.test(start) && /^[2-9TJQKA]{2}$/.test(end) && start[0]===start[1] && end[0]===end[1]) {
    const i1 = order.indexOf(start[0] as (typeof order)[number]);
    const i2 = order.indexOf(end[0] as (typeof order)[number]);
    const lo = Math.min(i1,i2); const hi = Math.max(i1,i2);
    return order.slice(lo, hi+1).map((r)=>`${r}${r}`);
  }
  if (/^[2-9TJQKA]{2}[so]$/.test(start) && /^[2-9TJQKA]{2}[so]$/.test(end) && start[0]===end[0] && start[2]===end[2]) {
    const hiRank = start[0];
    const suit = start[2];
    const i1 = order.indexOf(start[1] as (typeof order)[number]);
    const i2 = order.indexOf(end[1] as (typeof order)[number]);
    const lo = Math.min(i1,i2); const hi = Math.max(i1,i2);
    return order.slice(lo, hi+1).filter((r)=>r!==hiRank).map((r)=>`${hiRank}${r}${suit}`);
  }
  return [token];
};

export const handToKey = (cards: Card[]): string => {
  const [a, b] = [...cards].sort((x,y) => rankValue(y.rank)-rankValue(x.rank));
  if (a.rank === b.rank) return `${a.rank}${b.rank}`;
  return `${a.rank}${b.rank}${a.suit === b.suit ? 's' : 'o'}`;
};

export const expandRangeToken = (token: string): string[] => {
  const clean = token.trim();
  if (clean.includes('-')) return expandDashRange(clean);
  if (!clean.includes('+')) return [clean];
  const base = clean.slice(0, -1);
  if (/^[2-9TJQKA]{2}$/.test(base) && base[0] === base[1]) {
    const i = order.indexOf(base[0] as (typeof order)[number]);
    return order.slice(0, i + 1).map((r) => `${r}${r}`);
  }
  if (/^[2-9TJQKA]{2}[so]$/.test(base)) {
    const hi = base[0];
    const lo = base[1];
    const suit = base[2];
    const loI = order.indexOf(lo as (typeof order)[number]);
    return order.slice(loI, order.indexOf('2') + 1).filter((r) => r !== hi).map((r) => `${hi}${r}${suit}`);
  }
  return [base];
};

export const buildRangeSet = (tokens: string[]): Set<string> => {
  const set = new Set<string>();
  tokens.flatMap(expandRangeToken).forEach((t) => set.add(t));
  return set;
};

export const inRange = (cards: Card[], rangeSet: Set<string>): boolean => rangeSet.has(handToKey(cards));
