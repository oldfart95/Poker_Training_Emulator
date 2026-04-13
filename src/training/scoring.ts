import { Card } from '../engine/types';
import { rankValue } from '../engine/deck';
import { blindDefenseTargets, cBetTargets, confidenceFromFrequency, rfiTargetPct } from './pseudoSolverData';

export type TrainingAction = 'fold' | 'open' | 'call' | '3-bet' | 'c-bet 33%' | 'c-bet 75%' | 'check';
export type TrainingVerdict = 'Best' | 'Good' | 'Okay' | 'Mistake' | 'Punt';
export type EvBand = 'Clear +EV' | 'Close' | 'Clear -EV';

export interface TrainingFeedback {
  verdict: TrainingVerdict;
  scoreDelta: number;
  shortExplanation: string;
  bestAction: string;
  acceptableAlternatives: string[];
  coachNote: string;
  boardTexture?: string;
  rangeAdvantage?: string;
  evBand: EvBand;
  confidence: 'High' | 'Medium' | 'Low';
}

export interface PreflopContext {
  position: 'UTG' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB';
  facingOpen: boolean;
  openSizeBb?: number;
}

export interface CBetContext {
  heroWasAggressor: boolean;
  potType: 'single-raised' | '3-bet';
}

export interface BlindDefenseContext {
  heroSeat: 'SB' | 'BB';
  villainOpenPosition: 'CO' | 'BTN';
  openSizeBb: number;
}

const scoreForVerdict: Record<TrainingVerdict, number> = {
  Best: 12,
  Good: 7,
  Okay: 3,
  Mistake: -6,
  Punt: -12
};

const rankHand = (cards: Card[]) => cards.map((c) => rankValue(c.rank)).sort((a, b) => b - a);
const isSuited = (cards: Card[]) => cards[0].suit === cards[1].suit;
const isPair = (cards: Card[]) => cards[0].rank === cards[1].rank;
const isConnected = (cards: Card[]) => Math.abs(rankValue(cards[0].rank) - rankValue(cards[1].rank)) <= 1;

const verdictFromFrequency = (frequency: number): TrainingVerdict => {
  if (frequency >= 0.55) return 'Best';
  if (frequency >= 0.35) return 'Good';
  if (frequency >= 0.2) return 'Okay';
  if (frequency >= 0.1) return 'Mistake';
  return 'Punt';
};

const evBandFromFrequency = (frequency: number): EvBand => {
  if (frequency >= 0.4) return 'Clear +EV';
  if (frequency >= 0.2) return 'Close';
  return 'Clear -EV';
};
const coachWithConfidence = (base: string, confidence: 'High' | 'Medium' | 'Low') => `${base} Confidence: ${confidence}.`;

const bestAndAlternatives = (weights: Record<TrainingAction, number>) => {
  const sorted = Object.entries(weights).sort((a, b) => b[1] - a[1]) as [TrainingAction, number][];
  const best = sorted[0][0];
  const alternatives = sorted.filter(([action, freq]) => action !== best && freq >= 0.2).map(([action]) => action.toUpperCase());
  return { best: best.toUpperCase(), alternatives };
};

export const evaluatePreflop = (heroCards: Card[], action: TrainingAction, context: PreflopContext): TrainingFeedback => {
  const [hi, lo] = rankHand(heroCards);
  const suited = isSuited(heroCards);
  const pair = isPair(heroCards);
  const connected = isConnected(heroCards);
  const strength = pair ? hi + 6 : hi + lo + (suited ? 1 : 0) + (connected ? 1 : 0);
  const width = rfiTargetPct[context.position];

  const weights: Record<TrainingAction, number> = {
    fold: 0.8,
    open: 0,
    call: 0,
    '3-bet': 0,
    'c-bet 33%': 0,
    'c-bet 75%': 0,
    check: 0
  };

  if (!context.facingOpen) {
    const playable = Math.max(0, Math.min(1, ((strength - 10) / 14) * (width / 30)));
    weights.open = playable;
    weights.fold = 1 - playable;
  } else {
    const threeBetFreq = pair && hi >= 11 ? 0.58 : suited && hi >= 12 ? 0.42 : 0.12;
    const callFreq = suited || connected || hi >= 11 ? 0.38 : 0.1;
    weights['3-bet'] = threeBetFreq;
    weights.call = callFreq;
    weights.fold = Math.max(0.06, 1 - threeBetFreq - callFreq);
  }

  const pickedFreq = weights[action] ?? 0;
  const verdict = verdictFromFrequency(pickedFreq);
  const { best, alternatives } = bestAndAlternatives(weights);
  const confidence = confidenceFromFrequency(pickedFreq);

  return {
    verdict,
    scoreDelta: scoreForVerdict[verdict],
    shortExplanation: `${context.position} baseline width is about ${width}% RFI; this combo scores ${Math.round((1 - weights.fold) * 100)}% playable in this node.`,
    bestAction: best,
    acceptableAlternatives: alternatives,
    coachNote: coachWithConfidence('Pseudo-solver blend: treat close frequencies as mix spots and prefer lower-variance lines if unsure.', confidence),
    evBand: evBandFromFrequency(pickedFreq),
    confidence
  };
};

const boardTextureLabel = (board: Card[]): 'Dry' | 'Semi-wet' | 'Wet' => {
  const values = rankHand(board);
  const suitedCount = Math.max(...['♠', '♥', '♦', '♣'].map((s) => board.filter((c) => c.suit === s).length));
  const connected = Math.max(values[0] - values[1], values[1] - values[2]);
  if (suitedCount >= 3 || connected <= 2) return 'Wet';
  if (suitedCount === 2 || connected <= 4) return 'Semi-wet';
  return 'Dry';
};

const rangeAdvantageLabel = (board: Card[], heroWasAggressor: boolean): string => {
  const highBoard = board.some((c) => ['A', 'K', 'Q'].includes(c.rank));
  if (heroWasAggressor && highBoard) return 'Hero range edge';
  if (!heroWasAggressor && !highBoard) return 'Defender can realize';
  return 'Near-neutral';
};

export const evaluateCBet = (heroCards: Card[], board: Card[], action: TrainingAction, context: CBetContext): TrainingFeedback => {
  const texture = boardTextureLabel(board);
  const rangeAdvantage = rangeAdvantageLabel(board, context.heroWasAggressor);
  const topBroadway = heroCards.some((c) => ['A', 'K'].includes(c.rank));

  const baseline = texture === 'Dry' ? cBetTargets.dry : texture === 'Wet' ? cBetTargets.wet : cBetTargets.semiWet;
  const weights: Record<TrainingAction, number> = {
    fold: 0,
    open: 0,
    call: 0,
    '3-bet': 0,
    'c-bet 33%': baseline.small,
    'c-bet 75%': baseline.big,
    check: baseline.check
  };

  if (!context.heroWasAggressor) {
    weights.check = Math.max(weights.check, 0.55);
    weights['c-bet 33%'] = Math.min(weights['c-bet 33%'], 0.25);
  }
  if (texture === 'Wet' && topBroadway) {
    weights['c-bet 75%'] += 0.12;
    weights.check = Math.max(0.2, weights.check - 0.06);
  }

  const pickedFreq = weights[action] ?? 0;
  const verdict = verdictFromFrequency(pickedFreq);
  const { best, alternatives } = bestAndAlternatives(weights);
  const confidence = confidenceFromFrequency(pickedFreq);

  return {
    verdict,
    scoreDelta: scoreForVerdict[verdict],
    shortExplanation: `Texture ${texture} leans ${best}. Sizing shifts with equity denial needs and range interaction.`,
    bestAction: best,
    acceptableAlternatives: alternatives,
    coachNote: coachWithConfidence('Use small size often on dry boards; dynamic boards justify bigger bets or checks depending on nut advantage.', confidence),
    boardTexture: texture,
    rangeAdvantage,
    evBand: evBandFromFrequency(pickedFreq),
    confidence
  };
};

export const evaluateBlindDefense = (heroCards: Card[], action: TrainingAction, context: BlindDefenseContext): TrainingFeedback => {
  const [hi, lo] = rankHand(heroCards);
  const suited = isSuited(heroCards);
  const connected = isConnected(heroCards);
  const pair = isPair(heroCards);
  const trashOffsuit = !suited && !connected && hi <= 10 && lo <= 7;

  const targetKey = `${context.heroSeat.toLowerCase()}Vs${context.villainOpenPosition === 'BTN' ? 'Btn' : 'Co'}` as 'bbVsBtn' | 'bbVsCo' | 'sbVsBtn' | 'sbVsCo';
  const target = blindDefenseTargets[targetKey];

  const defendScore = trashOffsuit ? 0.04 : pair ? 0.7 : suited ? 0.45 : connected ? 0.34 : hi >= 11 ? 0.3 : 0.16;
  const threeBetScore = pair && hi >= 11 ? target.threeBetPct / 100 + 0.2 : suited && hi >= 12 ? target.threeBetPct / 100 : 0.06;
  const callScore = Math.max(0.06, defendScore - threeBetScore);

  const weights: Record<TrainingAction, number> = {
    fold: Math.max(0.05, 1 - (callScore + threeBetScore)),
    open: 0,
    call: callScore,
    '3-bet': threeBetScore,
    'c-bet 33%': 0,
    'c-bet 75%': 0,
    check: 0
  };

  const pickedFreq = weights[action] ?? 0;
  const verdict = verdictFromFrequency(pickedFreq);
  const { best, alternatives } = bestAndAlternatives(weights);
  const confidence = confidenceFromFrequency(pickedFreq);

  return {
    verdict,
    scoreDelta: scoreForVerdict[verdict],
    shortExplanation: `${context.heroSeat} vs ${context.villainOpenPosition} baseline defend target is ~${target.defendPct}% with ~${target.threeBetPct}% 3-bets.`,
    bestAction: best,
    acceptableAlternatives: alternatives,
    coachNote: coachWithConfidence('Defend playability: suitedness/connectivity realize equity better than disconnected offsuit combos.', confidence),
    evBand: evBandFromFrequency(pickedFreq),
    confidence
  };
};
