import { Card, Street } from '../engine/types';
import { Archetype } from './tuning/archetypes';
import { Position, handToKey } from './tuning/ranges';
import { decideStrategyAction } from '../strategy';
import { StrategyMode } from '../strategy/types';

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
  strategyMode?: StrategyMode;
}

export interface DecisionDebug {
  mode: StrategyMode;
  archetype: Archetype;
  handKey: string;
  bucket: string;
  texture: string;
  weights: Record<'fold'|'check'|'call'|'raise'|'all-in', number>;
  adjustments: string[];
  reason: string;
}

export const decideBotAction = (i: DecisionInput): {type:'fold'|'check'|'call'|'raise'|'all-in', amount:number, debug: DecisionDebug} => {
  const strategyMode: StrategyMode = i.strategyMode ?? 'exploit';
  const decision = decideStrategyAction({
    ...i,
    mode: strategyMode
  });

  return {
    type: decision.type,
    amount: decision.amount,
    debug: {
      mode: strategyMode,
      archetype: i.archetype,
      handKey: handToKey(i.cards),
      bucket: decision.debug.handBucket,
      texture: decision.debug.boardBucket,
      weights: decision.debug.policyWeights,
      adjustments: decision.debug.adjustments,
      reason: decision.debug.reason
    }
  };
};
