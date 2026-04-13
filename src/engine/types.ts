export type Suit = '♠' | '♥' | '♦' | '♣';
export type Rank = '2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'T'|'J'|'Q'|'K'|'A';

export interface Card {
  rank: Rank;
  suit: Suit;
}

export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
export type ActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all-in';

export interface ActionRecord {
  seat: number;
  playerName: string;
  street: Street;
  type: ActionType;
  amount: number;
}

export interface Player {
  id: string;
  name: string;
  isHero: boolean;
  stack: number;
  holeCards: Card[];
  folded: boolean;
  allIn: boolean;
  betThisStreet: number;
  totalContributed: number;
  seat: number;
  position: string;
  profile?: string;
}

export interface HandResult {
  rankName: string;
  score: number[];
}

export interface HandSummary {
  id: number;
  heroCards: Card[];
  heroPosition: string;
  board: Card[];
  actions: ActionRecord[];
  startingPot: number;
  sb: number;
  bb: number;
  resultChips: number;
  resultBb: number;
  rating: 'good'|'reasonable'|'questionable'|'punt';
  feedback: string;
  why: string;
  tighter: string;
  aggressive: string;
}

export interface SessionStats {
  hands: number;
  vpipOpportunities: number;
  vpipCount: number;
  pfrOpportunities: number;
  pfrCount: number;
  threeBetOpportunities: number;
  threeBetCount: number;
  foldToThreeBetOpportunities: number;
  foldToThreeBetCount: number;
  cBetOpportunities: number;
  cBetCount: number;
  wtsdCount: number;
  biggestWinBb: number;
  biggestPuntBb: number;
  winLossBb: number;
  mistakes: Record<'too loose preflop'|'passive error'|'bad call'|'bad bluff'|'overvalue hand', number>;
}

export type Mode = 'full-ring'|'preflop-trainer'|'cbet-trainer'|'blind-defense'|'replay';
