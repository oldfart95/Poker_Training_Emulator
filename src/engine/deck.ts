import { Card, Rank, Suit } from './types';

const suits: Suit[] = ['♠', '♥', '♦', '♣'];
const ranks: Rank[] = ['2','3','4','5','6','7','8','9','T','J','Q','K','A'];

export const rankValue = (rank: Rank): number => ranks.indexOf(rank) + 2;

export const createDeck = (): Card[] => {
  const deck: Card[] = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ rank, suit });
    }
  }
  return deck;
};

export const shuffleDeck = (deck: Card[], seed = Math.random()): Card[] => {
  const arr = [...deck];
  let x = Math.floor(seed * 2147483647) || 1;
  const rand = () => {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    return Math.abs(x) / 2147483647;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

export const formatCard = (card: Card): string => `${card.rank}${card.suit}`;
