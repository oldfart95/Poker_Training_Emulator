import { SessionStats } from '../engine/types';

const key = 'ppp_stats_v1';

export const saveStats = (stats: SessionStats) => localStorage.setItem(key, JSON.stringify(stats));
export const loadStats = (): SessionStats | null => {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try { return JSON.parse(raw) as SessionStats; } catch { return null; }
};
