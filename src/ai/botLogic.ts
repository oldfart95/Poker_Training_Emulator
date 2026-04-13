import { BotProfile } from './botProfiles';
import { Card, Street } from '../engine/types';
import { rankValue } from '../engine/deck';

const preflopStrength = (cards: Card[]): number => {
  const [a, b] = cards.map((c) => rankValue(c.rank)).sort((x,y) => y-x);
  const pairBonus = a === b ? 25 + a : 0;
  const suitedBonus = cards[0].suit === cards[1].suit ? 4 : 0;
  const connectorBonus = Math.abs(a-b) <= 1 ? 3 : 0;
  return a + b + pairBonus + suitedBonus + connectorBonus;
};

const boardTexture = (board: Card[]): 'dry'|'wet' => {
  if (board.length < 3) return 'dry';
  const suits = new Map<string, number>();
  board.forEach((c) => suits.set(c.suit, (suits.get(c.suit) ?? 0) + 1));
  const maxSuit = Math.max(...suits.values());
  const ranks = board.map((c) => rankValue(c.rank)).sort((a,b)=>a-b);
  const connected = ranks[2] - ranks[0] <= 4;
  return maxSuit >= 2 || connected ? 'wet' : 'dry';
};

export interface BotDecisionInput {
  profile: BotProfile;
  cards: Card[];
  board: Card[];
  street: Street;
  toCall: number;
  pot: number;
  minRaise: number;
  stack: number;
  canCheck: boolean;
  positionIndex: number;
  wasRaised: boolean;
}

export const botDecision = (i: BotDecisionInput): {type:'fold'|'check'|'call'|'raise'|'all-in', amount:number} => {
  const strength = preflopStrength(i.cards);
  const latePosBoost = i.positionIndex >= 4 ? 5 : 0;

  if (i.street === 'preflop') {
    const openThreshold = 18 + (1 - i.profile.vpip) * 18 - latePosBoost;
    if (i.wasRaised) {
      const defend = openThreshold + 8;
      if (strength < defend && i.toCall > 0) return { type: 'fold', amount: 0 };
      if (strength > defend + 14 && Math.random() < i.profile.threeBet) {
        const raiseTo = Math.min(i.stack, Math.max(i.minRaise, i.toCall * 3));
        return raiseTo === i.stack ? { type: 'all-in', amount: i.stack } : { type: 'raise', amount: raiseTo };
      }
      return i.toCall === 0 ? { type: 'check', amount: 0 } : { type: 'call', amount: i.toCall };
    }

    if (strength >= openThreshold && Math.random() < i.profile.pfr + (latePosBoost / 50)) {
      const raiseTo = Math.max(i.minRaise, Math.round(i.pot * 0.65));
      return { type: 'raise', amount: Math.min(raiseTo, i.stack) };
    }
    return i.canCheck ? { type: 'check', amount: 0 } : { type: 'fold', amount: 0 };
  }

  const potOdds = i.toCall / Math.max(1, i.pot + i.toCall);
  const texture = boardTexture(i.board);
  const attackChance = texture === 'dry' ? i.profile.cbet : i.profile.cbet - 0.12;

  if (i.toCall === 0 && Math.random() < attackChance) {
    const base = texture === 'dry' ? 0.33 : 0.6;
    return { type: 'raise', amount: Math.min(i.stack, Math.max(i.minRaise, Math.round(i.pot * base))) };
  }

  const callThreshold = 0.22 + (1 - i.profile.callDown) * 0.18;
  if (potOdds < callThreshold || Math.random() < i.profile.bluff * 0.15) {
    if (i.toCall >= i.stack) return { type: 'all-in', amount: i.stack };
    return i.toCall === 0 ? { type: 'check', amount: 0 } : { type: 'call', amount: i.toCall };
  }

  return i.toCall === 0 ? { type: 'check', amount: 0 } : { type: 'fold', amount: 0 };
};
