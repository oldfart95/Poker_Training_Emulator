import { Card } from '../../engine/types';
import { rankValue } from '../../engine/deck';

export type TextureWetness = 'dry'|'semi-wet'|'wet';

export interface BoardTexture {
  wetness: TextureWetness;
  paired: boolean;
  tone: 'rainbow'|'two-tone'|'monotone';
  highCardHeavy: boolean;
  lowConnected: boolean;
  scaryOvercard: boolean;
}

export const classifyBoardTexture = (board: Card[], prevBoard: Card[] = []): BoardTexture => {
  const ranks = board.map((c) => rankValue(c.rank)).sort((a,b)=>a-b);
  const suits = new Map<string, number>();
  board.forEach((c) => suits.set(c.suit, (suits.get(c.suit) ?? 0) + 1));
  const maxSuit = Math.max(...suits.values());
  const tone = maxSuit >= 3 ? 'monotone' : maxSuit === 2 ? 'two-tone' : 'rainbow';

  const paired = new Set(ranks).size !== ranks.length;
  const span = ranks.length >= 3 ? ranks[ranks.length - 1] - ranks[0] : 10;
  const lowConnected = ranks.length >= 3 && ranks[ranks.length - 1] <= 10 && span <= 5;
  const highCardHeavy = ranks.some((r) => r >= 11) && ranks.filter((r) => r >= 10).length >= 2;

  const wetnessScore = (paired ? -1 : 0) + (tone === 'monotone' ? 2 : tone === 'two-tone' ? 1 : 0) + (span <= 4 ? 2 : span <= 7 ? 1 : 0) + (lowConnected ? 1 : 0);
  const wetness: TextureWetness = wetnessScore >= 4 ? 'wet' : wetnessScore >= 2 ? 'semi-wet' : 'dry';

  const prevHigh = prevBoard.length ? Math.max(...prevBoard.map((c) => rankValue(c.rank))) : 0;
  const currentHigh = board.length ? Math.max(...board.map((c) => rankValue(c.rank))) : 0;
  const scaryOvercard = board.length > prevBoard.length && currentHigh > prevHigh && currentHigh >= 11;

  return { wetness, paired, tone, highCardHeavy, lowConnected, scaryOvercard };
};
