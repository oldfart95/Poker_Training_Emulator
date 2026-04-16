import { Card } from '../engine/types';
import { createDeck } from '../engine/deck';
import { BlindDefenseContext, CBetContext, PreflopContext, TrainingAction } from './scoring';

export interface DrillSpot {
  prompt: string;
  choices: TrainingAction[];
  note: string;
  heroCards: Card[];
  board?: Card[];
  context: PreflopContext | CBetContext | BlindDefenseContext;
  category: 'preflop-trainer' | 'cbet-trainer' | 'blind-defense';
  seedTag?: string;
}

export interface DrillOptions {
  seed?: number;
  index?: number;
}

export type DrillCategory = 'preflop-trainer' | 'cbet-trainer' | 'blind-defense';

const mulberry32 = (seed: number) => {
  let t = seed + 0x6d2b79f5;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
};

const createRng = (options?: DrillOptions): (() => number) => {
  if (options?.seed === undefined) return Math.random;
  return mulberry32(options.seed + (options.index ?? 0) * 9973);
};

const shuffleWithRng = <T>(items: T[], rand: () => number): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const drawCards = (n: number, rand: () => number): Card[] => shuffleWithRng(createDeck(), rand).slice(0, n);
const pick = <T>(items: T[], rand: () => number): T => items[Math.floor(rand() * items.length)];

export const nextDrillSpot = (mode: DrillCategory, options?: DrillOptions): DrillSpot | null => {
  const rand = createRng(options);
  const seedTag = options?.seed !== undefined ? `${options.seed}:${options.index ?? 0}` : undefined;

  if (mode === 'preflop-trainer') {
    const position = pick<PreflopContext['position']>(['UTG', 'HJ', 'CO', 'BTN', 'SB'], rand);
    const facingOpen = rand() > 0.45;
    return {
      category: 'preflop-trainer',
      prompt: facingOpen ? `${position} facing open: Fold / Call / 3-bet` : `${position} first in: Fold / Open`,
      choices: facingOpen ? ['fold', 'call', '3-bet'] : ['fold', 'open'],
      note: 'Pseudo-solver trainer: practical baselines, not exact equilibrium outputs.',
      heroCards: drawCards(2, rand),
      context: { position, facingOpen, openSizeBb: 2.5 },
      seedTag
    };
  }

  if (mode === 'cbet-trainer') {
    const all = drawCards(5, rand);
    const heroWasAggressor = rand() > 0.3;
    return {
      category: 'cbet-trainer',
      prompt: 'Flop plan: choose c-bet 33%, c-bet 75%, or check',
      choices: ['c-bet 33%', 'c-bet 75%', 'check'],
      note: 'Evaluate texture + range edge + sizing fit; mixed nodes stay mixed.',
      heroCards: all.slice(0, 2),
      board: all.slice(2),
      context: { heroWasAggressor, potType: rand() > 0.7 ? '3-bet' : 'single-raised' },
      seedTag
    };
  }

  if (mode === 'blind-defense') {
    return {
      category: 'blind-defense',
      prompt: 'Blind defense vs late-position open: Fold / Call / 3-bet',
      choices: ['fold', 'call', '3-bet'],
      note: 'Favor playability and avoid dominated offsuit trash in low-realization nodes.',
      heroCards: drawCards(2, rand),
      context: {
        heroSeat: rand() > 0.5 ? 'BB' : 'SB',
        villainOpenPosition: rand() > 0.55 ? 'BTN' : 'CO',
        openSizeBb: 2.5
      },
      seedTag
    };
  }

  return null;
};
