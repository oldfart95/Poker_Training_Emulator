import { classifyBoardBucket } from '../strategy/buckets/boardBuckets';
import { classifyHandBucket } from '../strategy/buckets/handBuckets';
import { StrategyMode } from '../strategy/types';
import { Card, Mode, Street } from '../engine/types';
import { Archetype } from '../ai/tuning/archetypes';
import { boardHints, handHints, modeLens } from './hintTemplates';

interface HintContext {
  mode: Mode;
  strategyMode: StrategyMode;
  street: Street;
  heroCards: Card[];
  board: Card[];
  heroPosition?: string;
  opponentArchetype?: Archetype | string;
  heroAggressor?: boolean;
  trainerType?: Exclude<Mode, 'full-ring' | 'replay'>;
}

export interface SpotHint {
  quick: string;
  explainMore: string;
}

const trainerLead: Record<Exclude<Mode, 'full-ring' | 'replay'>, string> = {
  'preflop-trainer': 'Training focus: choose Fold / Open / 3-bet / Call with position discipline.',
  'cbet-trainer': 'Training focus: choose check, small c-bet, or large c-bet based on texture and range edge.',
  'blind-defense': 'Training focus: defend selectively from the blinds versus late opens.'
};

export const generateSpotHint = (ctx: HintContext): SpotHint => {
  const boardBucket = classifyBoardBucket(ctx.board);
  const handBucket = classifyHandBucket(ctx.heroCards, ctx.board);
  const modeHint = modeLens[ctx.strategyMode];

  const quickParts = [
    modeHint.quick,
    handHints[handBucket].quick,
    ctx.street !== 'preflop' ? boardHints[boardBucket].quick : `You are ${ctx.heroPosition ?? 'in position flow'} preflop, so opening discipline matters.`
  ];

  if (ctx.opponentArchetype) {
    quickParts.push(`Versus ${ctx.opponentArchetype}, adjust aggression to their tendency.`);
  }

  const detailParts = [
    modeHint.detail,
    `Context: ${ctx.street.toUpperCase()} • Hand bucket: ${handBucket.replace(/-/g, ' ')}${ctx.board.length ? ` • Board: ${boardBucket.replace(/-/g, ' ')}` : ''}.`,
    handHints[handBucket].detail,
    ctx.board.length ? boardHints[boardBucket].detail : 'Preflop spots are driven most by position and facing action.',
    ctx.heroAggressor ? 'You were the aggressor, so you can represent stronger top-end more often.' : 'You were not last aggressor, so protect your check/call range and avoid auto-piloting aggression.'
  ];

  if (ctx.mode !== 'full-ring' && ctx.mode !== 'replay' && ctx.trainerType) {
    detailParts.unshift(trainerLead[ctx.trainerType]);
  }

  return {
    quick: quickParts.join(' '),
    explainMore: detailParts.join(' ')
  };
};
