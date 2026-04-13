import { Card } from '../../engine/types';
import { rankValue } from '../../engine/deck';

export type BoardBucket =
  | 'a-high-dry'
  | 'k-high-dry'
  | 'paired-dry'
  | 'low-connected-wet'
  | 'middling-two-tone'
  | 'monotone'
  | 'broadway-dynamic'
  | 'low-disconnected';

export const classifyBoardBucket = (board: Card[]): BoardBucket => {
  if (board.length < 3) return 'low-disconnected';
  const values = board.map((c) => rankValue(c.rank)).sort((a, b) => b - a);
  const suits = new Map<string, number>();
  board.forEach((c) => suits.set(c.suit, (suits.get(c.suit) ?? 0) + 1));
  const suitCounts = [...suits.values()].sort((a, b) => b - a);
  const isPaired = new Set(board.map((c) => c.rank)).size < board.length;
  const connected = values[0] - values[values.length - 1] <= 4;
  const broadwayCount = values.filter((v) => v >= 10).length;

  if (suitCounts[0] >= 3) return 'monotone';
  if (isPaired && broadwayCount <= 1) return 'paired-dry';
  if (values[0] === 14 && suitCounts[0] === 1 && !connected) return 'a-high-dry';
  if (values[0] === 13 && suitCounts[0] === 1 && !connected) return 'k-high-dry';
  if (connected && values[0] <= 10) return 'low-connected-wet';
  if (broadwayCount >= 2 && connected) return 'broadway-dynamic';
  if (suitCounts[0] === 2 && values[0] <= 12 && values[0] >= 8) return 'middling-two-tone';
  return 'low-disconnected';
};
