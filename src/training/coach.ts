import { ActionRecord, Card, Player } from '../engine/types';
import { rankValue } from '../engine/deck';

const hasAceHighOnly = (cards: Card[], board: Card[]): boolean => {
  const vals = [...cards, ...board].map((c) => rankValue(c.rank));
  const pairs = vals.some((v, i) => vals.indexOf(v) !== i);
  return cards.some((c) => c.rank === 'A') && !pairs;
};

const inferVillain = (actions: ActionRecord[], players: Player[]): Player | undefined => {
  const villainSeat = [...actions].reverse().find((a) => a.seat !== 0 && ['raise','all-in','call'].includes(a.type))?.seat;
  return players.find((p) => p.seat === villainSeat);
};

const tendencyHint = (profile?: string): string => {
  if (!profile) return 'Unknown tendency.';
  if (profile === 'Calling Station') return 'This opponent overcalls and under-bluffs; pure bluffs lose value.';
  if (profile === 'Maniac') return 'This opponent over-bluffs and over-barrels; bluff-catching improves.';
  if (profile === 'Nit') return 'This opponent is value-heavy; folding bluff-catchers is often fine.';
  if (profile === 'LAG') return 'This opponent applies frequent pressure; ranges are wider.';
  return 'TAGs are balanced enough to demand better blockers and pot-odds discipline.';
};

export const rateHand = (hero: Player, board: Card[], actions: ActionRecord[], delta: number, bb: number, players: Player[]) => {
  const vpip = actions.find((a) => a.seat === 0 && a.street === 'preflop' && ['call','raise','all-in'].includes(a.type));
  const riverCall = [...actions].reverse().find((a) => a.seat === 0 && a.street === 'river' && a.type === 'call');
  const villain = inferVillain(actions, players);
  const oppHint = tendencyHint(villain?.profile);

  if (!vpip && hero.position === 'UTG' && hero.holeCards.some((c) => ['2','3','4','5','6'].includes(c.rank))) {
    return {
      rating: 'good' as const,
      feedback: `Disciplined UTG fold. ${oppHint}`,
      why: 'Early position wants tighter combos, especially offsuit low-card hands.',
      tighter: 'Keep folding weak offsuit broadway/low card combos from UTG.',
      aggressive: 'Open more from CO/BTN where position supports wider ranges.'
    };
  }

  if (riverCall && hasAceHighOnly(hero.holeCards, board) && delta < -1.5 * bb) {
    return {
      rating: 'punt' as const,
      feedback: `Calling river with ace-high was too optimistic. ${oppHint}`,
      why: 'River aggression from tighter pools is under-bluffed; ace-high under-realizes equity at showdown.',
      tighter: 'Fold river bluff-catchers unless pot odds are exceptional and blockers help.',
      aggressive: 'Apply pressure earlier (flop/turn) when ranges are wider.'
    };
  }

  if (delta > 0) {
    return {
      rating: 'reasonable' as const,
      feedback: `Line was practical and profitable this hand. ${oppHint}`,
      why: 'You avoided major leaks and got value from worse holdings.',
      tighter: 'Trim marginal preflop calls out of position.',
      aggressive: 'Increase turn barrels on favorable runouts versus capped ranges.'
    };
  }

  return {
    rating: 'questionable' as const,
    feedback: `Playable, but there may be cleaner EV paths. ${oppHint}`,
    why: 'Some decisions leaned passive or thin without strong equity clarity.',
    tighter: 'Reduce loose preflop involvement from early positions.',
    aggressive: 'When attacking, prefer initiative with planned barrel cards.'
  };
};
