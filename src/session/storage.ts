import type { GameState } from '../engine/gameEngine';
import type { PersistedAppSnapshot, SessionRecord } from './types';
import { SESSION_STORAGE_VERSION, isGameStateLike, isPersistedAppSnapshot } from './types';

const SNAPSHOT_KEY = 'ppp:app-snapshot:v1';

export interface RestoredAppSnapshot extends PersistedAppSnapshot<GameState> {}

const isGameState = (candidate: unknown): candidate is GameState => isGameStateLike(candidate);

export const loadAppSnapshot = (): RestoredAppSnapshot | null => {
  const raw = localStorage.getItem(SNAPSHOT_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (isPersistedAppSnapshot(parsed, isGameState)) {
      return parsed;
    }
  } catch {
    // Ignore malformed snapshots and reset below.
  }

  localStorage.removeItem(SNAPSHOT_KEY);
  return null;
};

export const saveAppSnapshot = (snapshot: RestoredAppSnapshot) => {
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
};

export const clearAppSnapshot = () => {
  localStorage.removeItem(SNAPSHOT_KEY);
};

export const buildAppSnapshot = ({
  mode,
  strategyMode,
  paceMode,
  replayStep,
  betAmount,
  gameState,
  sessionRecord
}: {
  mode: RestoredAppSnapshot['mode'];
  strategyMode: RestoredAppSnapshot['strategyMode'];
  paceMode: RestoredAppSnapshot['paceMode'];
  replayStep: number;
  betAmount: number;
  gameState: GameState;
  sessionRecord: SessionRecord;
}): RestoredAppSnapshot => ({
  version: SESSION_STORAGE_VERSION,
  savedAt: new Date().toISOString(),
  mode,
  strategyMode,
  paceMode,
  replayStep,
  betAmount,
  gameState,
  sessionRecord
});
