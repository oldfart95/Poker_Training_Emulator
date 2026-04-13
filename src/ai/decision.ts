import { Card, Street } from '../engine/types';
import { Archetype, archetypes } from './tuning/archetypes';
import { classifyBoardTexture } from './tuning/boardTexture';
import { categorizeHand } from './tuning/handBuckets';
import { Position, handToKey, inRange } from './tuning/ranges';

export interface DecisionInput {
  archetype: Archetype;
  cards: Card[];
  board: Card[];
  previousBoard: Card[];
  street: Street;
  toCall: number;
  pot: number;
  minRaise: number;
  stack: number;
  canCheck: boolean;
  position: Position;
  playersInHand: number;
  wasPreflopAggressor: boolean;
  facingThreeBet: boolean;
  hasBetThisStreet: boolean;
}

export interface DecisionDebug {
  archetype: Archetype;
  handKey: string;
  bucket: string;
  texture: string;
  weights: Record<'fold'|'check'|'call'|'raise'|'all-in', number>;
  reason: string;
}

const weightedChoice = <T extends string>(weights: Record<T, number>): T => {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((s, [,w]) => s + Math.max(0, w), 0);
  let roll = Math.random() * Math.max(total, 0.0001);
  for (const [k, w] of entries) {
    roll -= Math.max(0, w);
    if (roll <= 0) return k;
  }
  return entries[0][0];
};

const sizeFromTexture = (pot: number, texture: 'dry'|'semi-wet'|'wet', minRaise: number, stack: number): number => {
  const pct = texture === 'dry' ? 0.33 : texture === 'semi-wet' ? 0.5 : 0.75;
  return Math.min(stack, Math.max(minRaise, Math.round(pot * pct)));
};

export const decideBotAction = (i: DecisionInput): {type:'fold'|'check'|'call'|'raise'|'all-in', amount:number, debug: DecisionDebug} => {
  const profile = archetypes[i.archetype];
  const texture = classifyBoardTexture(i.board, i.previousBoard);
  const bucket = categorizeHand(i.cards, i.board);
  const key = handToKey(i.cards);

  const weights: Record<'fold'|'check'|'call'|'raise'|'all-in', number> = { fold: 0.01, check: 0.01, call: 0.01, raise: 0.01, 'all-in': 0.005 };
  let reason = '';

  if (i.street === 'preflop') {
    const ranges = profile.ranges[i.position];
    const inOpen = inRange(i.cards, ranges.openRaise);
    const inCall = inRange(i.cards, ranges.flatVsOpen) || (i.position === 'BB' && inRange(i.cards, ranges.blindDefense));
    const in3b = inRange(i.cards, ranges.threeBetVsOpen);
    const inContinue = i.facingThreeBet ? inRange(i.cards, ranges.continueVsThreeBet) : inRange(i.cards, ranges.fourBetContinue);

    if (i.toCall === 0) {
      weights.raise += inOpen ? 0.85 : 0.04;
      weights.check += inOpen ? 0.1 : 0.8;
      reason = inOpen ? 'Open-raise range hand.' : 'Out of opening range.';
    } else if (i.facingThreeBet) {
      weights.fold += inContinue ? 0.12 : 0.85;
      weights.call += inContinue ? 0.45 : 0.1;
      weights.raise += inContinue ? 0.22 : 0.02;
      weights['all-in'] += inContinue ? 0.08 : 0;
      reason = inContinue ? 'Continue vs 3-bet range.' : 'Not strong enough vs 3-bet.';
    } else {
      weights.fold += inCall || in3b ? 0.15 : 0.82;
      weights.call += inCall ? 0.46 : 0.08;
      weights.raise += in3b ? 0.42 : 0.05;
      reason = in3b ? '3-bet value/bluff candidate.' : inCall ? 'Flat-call candidate.' : 'Fold candidate vs open.';
    }

    if (profile.name === 'Calling Station') {
      weights.call += 0.16;
      weights.raise -= 0.1;
    }
    if (profile.name === 'Maniac') {
      weights.raise += 0.2;
      weights.fold -= 0.15;
    }
  } else {
    const streetProfile = profile.street[i.street === 'flop' ? 'flop' : i.street === 'turn' ? 'turn' : 'river'];
    const isMultiway = i.playersInHand >= 3;
    const cbetBase = profile.cbetBase[texture.wetness === 'semi-wet' ? 'semiWet' : texture.wetness];

    if (i.toCall === 0) {
      const canCbet = i.street === 'flop' && i.wasPreflopAggressor;
      const cbetWeight = canCbet ? cbetBase : streetProfile.barrelFreq;
      const multiwayPenalty = isMultiway ? profile.cbetBase.multiwayPenalty : 0;
      weights.raise += cbetWeight - multiwayPenalty;
      weights.check += 0.35 + multiwayPenalty;

      if (['monster','strong-made'].includes(bucket)) weights.raise += 0.35;
      if (bucket === 'medium-made') weights.raise += 0.16;
      if (bucket === 'air') weights.raise += streetProfile.bluffFreq * (isMultiway ? 0.4 : 1);
      if (bucket === 'weak-showdown') weights.check += 0.25;

      reason = canCbet ? `C-bet spot (${texture.wetness})` : `Barrel/check spot (${texture.wetness})`;
    } else {
      const potOdds = i.toCall / Math.max(1, i.pot + i.toCall);
      const bluffGate = streetProfile.bluffFreq * (texture.wetness === 'wet' ? 0.7 : 1) * (isMultiway ? 0.45 : 1);

      if (['monster','strong-made'].includes(bucket)) {
        weights.raise += 0.42 * streetProfile.raiseValueBias;
        weights.call += 0.3;
      } else if (bucket === 'medium-made') {
        weights.call += 0.42 + streetProfile.callDown * 0.2;
        weights.raise += 0.11;
      } else if (bucket === 'weak-showdown') {
        weights.call += streetProfile.callDown * (potOdds < 0.35 ? 0.6 : 0.25);
        weights.fold += 0.35;
      } else if (['strong-draw','weak-draw'].includes(bucket)) {
        weights.call += 0.42;
        weights.raise += bluffGate * 0.6;
      } else {
        weights.fold += 0.58;
        weights.raise += bluffGate;
      }

      if (profile.name === 'Calling Station') {
        weights.call += 0.22;
        weights.raise -= 0.1;
      }
      if (profile.name === 'Nit' && bucket === 'weak-showdown') {
        weights.fold += 0.18;
      }
      if (profile.name === 'Maniac') {
        weights.raise += 0.2;
        weights.fold -= 0.1;
      }

      reason = `Facing bet with ${bucket} on ${texture.wetness} board.`;
    }
  }

  const type = weightedChoice(weights);
  const amount = type === 'raise' ? sizeFromTexture(i.pot, texture.wetness, i.minRaise, i.stack) : type === 'all-in' ? i.stack : type === 'call' ? i.toCall : 0;

  return { type: type === 'check' && !i.canCheck ? 'call' : type, amount, debug: { archetype: i.archetype, handKey: key, bucket, texture: `${texture.wetness}/${texture.tone}${texture.paired ? '/paired' : ''}`, weights, reason } };
};
