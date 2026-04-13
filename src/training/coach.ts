import { ActionRecord, Card, Player } from '../engine/types';
import { rankValue } from '../engine/deck';

const hasAceHighOnly = (cards: Card[], board: Card[]): boolean => {
  const vals = [...cards, ...board].map((c) => rankValue(c.rank));
  const pairs = vals.some((v, i) => vals.indexOf(v) !== i);
  return cards.some((c) => c.rank === 'A') && !pairs;
};

export const rateHand = (hero: Player, board: Card[], actions: ActionRecord[], delta: number, bb: number) => {
  const vpip = actions.find((a) => a.seat === 0 && a.street === 'preflop' && ['call','raise','all-in'].includes(a.type));
  const riverCall = [...actions].reverse().find((a) => a.seat === 0 && a.street === 'river' && a.type === 'call');

  if (!vpip && hero.position === 'UTG' && hero.holeCards.some((c) => ['2','3','4','5','6'].includes(c.rank))) {
    return {
      rating: 'good' as const,
      feedback: 'Disciplined UTG fold. Nice preflop control.',
      why: 'Early position wants tighter combos, especially offsuit low-card hands.',
      tighter: 'Keep folding weak offsuit broadway/low card combos from UTG.',
      aggressive: 'Open more from CO/BTN where position supports wider ranges.'
    };
  }

  if (riverCall && hasAceHighOnly(hero.holeCards, board) && delta < -1.5 * bb) {
    return {
      rating: 'punt' as const,
      feedback: 'Calling river with ace-high was too optimistic versus this line.',
      why: 'River aggression from tighter pools is under-bluffed; ace-high under-realizes equity at showdown.',
      tighter: 'Fold river bluff-catchers unless pot odds are exceptional and blockers help.',
      aggressive: 'Apply pressure earlier (flop/turn) when ranges are wider.'
    };
  }

  if (delta > 0) {
    return {
      rating: 'reasonable' as const,
      feedback: 'Line was practical and profitable this hand.',
      why: 'You avoided major leaks and got value from worse holdings.',
      tighter: 'Trim marginal preflop calls out of position.',
      aggressive: 'Increase turn barrels on favorable runouts versus capped ranges.'
    };
  }

  return {
    rating: 'questionable' as const,
    feedback: 'This line is playable, but there may be cleaner EV paths.',
    why: 'Some decisions leaned passive or thin without strong equity clarity.',
    tighter: 'Reduce loose preflop involvement from early positions.',
    aggressive: 'When attacking, prefer initiative with planned barrel cards.'
  };
};
