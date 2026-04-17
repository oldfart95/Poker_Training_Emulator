import { Card, Street } from '../engine/types';
import { Archetype } from '../ai/tuning/archetypes';
import { Position } from '../ai/tuning/ranges';

export type StrategyMode = 'exploit' | 'blueprint';
export type ActionKind = 'fold' | 'check' | 'call' | 'raise' | 'all_in';

export interface StrategyContext {
  mode: StrategyMode;
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

export interface StrategyDebug {
  mode: StrategyMode;
  archetype: Archetype;
  handKey: string;
  handBucket: string;
  boardBucket: string;
  policyWeights: Record<ActionKind, number>;
  adjustments: string[];
  reason: string;
}
