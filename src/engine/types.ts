export type Suit = '\u2660' | '\u2665' | '\u2666' | '\u2663';
export type Rank = '2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'T'|'J'|'Q'|'K'|'A';

export interface Card {
  rank: Rank;
  suit: Suit;
}

export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
export type ActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all_in' | 'post_blind';

export interface LegalActionsSnapshot {
  actorSeat: number;
  street: Street;
  canFold: boolean;
  canCheck: boolean;
  canCall: boolean;
  canBet: boolean;
  canRaise: boolean;
  canAllIn: boolean;
  amountToCall: number;
  currentBet: number;
  minRaiseSize: number;
  minBetOrRaiseTo: number | null;
  maxToAmount: number;
}

export interface ActionRecord {
  actionIndex: number;
  timestamp: string;
  seat: number;
  playerName: string;
  street: Street;
  type: ActionType;
  amount: number;
  toAmount: number;
  potBefore: number;
  potAfter: number;
  stackBefore: number;
  stackAfter: number;
  amountToCallBefore: number;
  amountToCallAfter: number;
  isAllIn: boolean;
  legalActionsSnapshot?: LegalActionsSnapshot;
  note?: string;
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
  busted: boolean;
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
  buttonSeat: number;
  smallBlindSeat: number;
  bigBlindSeat: number;
  startingStacks: Record<string, number>;
  endingStacks: Record<string, number>;
  activePlayersAtStart: number[];
  activeSeatMap: boolean[];
  tableSizeAtStart: number;
  showdown: boolean;
  winners: Array<{
    seat: number;
    name: string;
    amountWon: number;
    winningCards?: Card[];
  }>;
  busts: Array<{
    seat: number;
    name: string;
    stackLost: number;
  }>;
  handIntegrity: 'valid' | 'invalid';
  integrityErrors: string[];
  engineVersion: string;
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

export type Mode = 'full-ring'|'replay';
