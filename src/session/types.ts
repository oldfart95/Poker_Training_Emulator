import type { ActionType, Card, Mode, Street } from '../engine/types';
import type { LegalActionsSnapshot } from '../engine/types';
import type { PaceMode } from '../presentation/pacing';
import type { StrategyMode } from '../strategy/types';

export const SESSION_FORMAT_VERSION = '1.0.0';
export const SESSION_STORAGE_VERSION = '1';

export type SessionStatus = 'active' | 'completed';
export type HandLogStatus = 'active' | 'completed';
export type SessionLifecycleEventType = 'session_started' | 'session_restored' | 'exported' | 'copied_json' | 'reset';
export type SessionCurrency = 'chips' | 'bb';
export type SessionActionType =
  | ActionType
  | 'post_blind'
  | 'deal'
  | 'street_advance'
  | 'show'
  | 'muck'
  | 'win'
  | 'bust'
  | 'coach_hint';

export interface SessionEnvironment {
  mode: Mode;
  roomPolicy: StrategyMode;
  pace: PaceMode;
}

export interface SessionLifecycleEvent {
  type: SessionLifecycleEventType;
  timestamp: string;
  note?: string;
}

export interface SessionPlayerMeta {
  seat: number;
  name: string;
  archetype: string;
  isHero: boolean;
}

export interface SessionTableMeta {
  maxSeats: number;
  smallBlind?: number;
  bigBlind?: number;
  ante?: number;
  currency?: SessionCurrency;
  buttonStartSeat?: number;
}

export interface SessionActorSnapshot {
  seat: number;
  name: string;
  position: string;
  isHero: boolean;
  stack: number;
}

export interface SessionRevealedCards {
  seat: number;
  name: string;
  cards: string[];
  reason: 'showdown' | 'known';
}

export interface SessionCoachHint {
  timestamp: string;
  street: Street;
  quick: string;
  detail: string;
}

export interface SessionBustEvent {
  seat: number;
  name: string;
  timestamp: string;
  stackLost: number;
}

export interface SessionWinner {
  seat: number;
  name: string;
  amountWon: number;
  winningCards?: string[];
}

export interface SessionBoardState {
  flop: string[];
  turn: string | null;
  river: string | null;
}

export interface SessionActionEvent {
  actionIndex: number;
  timestamp: string;
  street: Street;
  actorSeat: number;
  actorName: string;
  action: SessionActionType;
  amount: number;
  toAmount?: number;
  potBefore?: number;
  potAfter?: number;
  stackBefore?: number;
  stackAfter?: number;
  amountToCallBefore?: number;
  amountToCallAfter?: number;
  isAllIn?: boolean;
  legalActionsSnapshot?: LegalActionsSnapshot;
  note?: string;
}

export interface SessionHandResult {
  showdown: boolean;
  winnerSeats: number[];
  winners: SessionWinner[];
  heroInvolved: boolean;
  heroWon: boolean;
  heroFoldStreet: Street | null;
  heroResultChips: number | null;
  heroResultBb: number | null;
  potFinal: number | null;
  rating?: 'good' | 'reasonable' | 'questionable' | 'punt';
  feedback?: string;
  why?: string;
  tighter?: string;
  aggressive?: string;
}

export interface SessionHandLog {
  handNumber: number;
  handId: string;
  heroSeat?: number;
  status: HandLogStatus;
  startedAt: string;
  endedAt: string | null;
  buttonSeat: number;
  smallBlindSeat: number;
  bigBlindSeat: number;
  activePlayersAtStart: SessionActorSnapshot[];
  startingStacks: Record<string, number>;
  heroHoleCards: string[];
  revealedHoleCards: SessionRevealedCards[];
  board: SessionBoardState;
  actions: SessionActionEvent[];
  endingStacks: Record<string, number> | null;
  busts: SessionBustEvent[];
  coachHints: SessionCoachHint[];
  handIntegrity: 'valid' | 'invalid';
  integrityErrors: string[];
  engineVersion: string;
  tableSizeAtStart: number;
  activeSeatMap: boolean[];
  result: SessionHandResult;
  notes: string[];
}

export interface SessionSummary {
  hands: number;
  netBb: number;
  vpip: number;
  pfr: number;
  wtsd: number;
  aggression: number;
  bestHandBb: number;
  worstHandBb: number;
  eliminations: number;
}

export interface SessionRecord {
  formatVersion: typeof SESSION_FORMAT_VERSION;
  schemaVersion?: typeof SESSION_FORMAT_VERSION;
  app: 'Pocket Pixel Poker';
  session: {
    id: string;
    startedAt: string;
    endedAt: string | null;
    mode: Mode;
    roomPolicy: StrategyMode;
    pace: PaceMode;
    heroSeat?: number;
    handsPlayed: number;
    status: SessionStatus;
  };
  table: SessionTableMeta;
  players: SessionPlayerMeta[];
  hands: SessionHandLog[];
  sessionEvents: SessionLifecycleEvent[];
}

export interface SessionExport extends SessionRecord {
  exportedAt: string;
  summary: SessionSummary;
}

export interface PersistedAppSnapshot<TGameState> {
  version: typeof SESSION_STORAGE_VERSION;
  savedAt: string;
  mode: Mode;
  strategyMode: StrategyMode;
  paceMode: PaceMode;
  replayStep: number;
  betAmount: number;
  gameState: TGameState;
  sessionRecord: SessionRecord;
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const isCard = (value: unknown): value is Card => isObject(value) && typeof value.rank === 'string' && typeof value.suit === 'string';
const isStreet = (value: unknown): value is Street => value === 'preflop' || value === 'flop' || value === 'turn' || value === 'river' || value === 'showdown';

export const isSessionRecord = (value: unknown): value is SessionRecord => {
  if (!isObject(value)) return false;
  if (value.formatVersion !== SESSION_FORMAT_VERSION || value.app !== 'Pocket Pixel Poker') return false;
  if (!isObject(value.session) || !Array.isArray(value.players) || !Array.isArray(value.hands) || !Array.isArray(value.sessionEvents)) return false;

  return typeof value.session.id === 'string'
    && typeof value.session.startedAt === 'string'
    && typeof value.session.mode === 'string'
    && typeof value.session.roomPolicy === 'string'
    && typeof value.session.pace === 'string'
    && typeof value.session.handsPlayed === 'number'
    && (value.schemaVersion === undefined || value.schemaVersion === SESSION_FORMAT_VERSION)
    && (value.session.heroSeat === undefined || typeof value.session.heroSeat === 'number')
    && value.hands.every((hand) => (
      isObject(hand)
      && typeof hand.handNumber === 'number'
      && typeof hand.handId === 'string'
      && (hand.heroSeat === undefined || typeof hand.heroSeat === 'number')
      && Array.isArray(hand.heroHoleCards)
      && Array.isArray(hand.actions)
      && isObject(hand.board)
    ));
};

export const isPersistedAppSnapshot = <TGameState>(
  value: unknown,
  isGameState: (candidate: unknown) => candidate is TGameState
): value is PersistedAppSnapshot<TGameState> => {
  if (!isObject(value) || value.version !== SESSION_STORAGE_VERSION) return false;
  return typeof value.savedAt === 'string'
    && typeof value.mode === 'string'
    && typeof value.strategyMode === 'string'
    && typeof value.paceMode === 'string'
    && typeof value.replayStep === 'number'
    && typeof value.betAmount === 'number'
    && isGameState(value.gameState)
    && isSessionRecord(value.sessionRecord);
};

export const isGameStateLike = (value: unknown): boolean => {
  if (!isObject(value)) return false;
  if (!Array.isArray(value.players) || !Array.isArray(value.board) || !Array.isArray(value.actions)) return false;
  return value.players.every((player) => isObject(player) && typeof player.seat === 'number' && Array.isArray(player.holeCards) && player.holeCards.every(isCard))
    && value.board.every(isCard)
    && value.actions.every((action) => isObject(action) && isStreet(action.street));
};
