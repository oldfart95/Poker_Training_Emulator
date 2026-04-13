import { Card, Mode } from '../engine/types';
import { createDeck, shuffleDeck } from '../engine/deck';

export interface DrillSpot {
  prompt: string;
  choices: string[];
  answer: string;
  note: string;
  heroCards: Card[];
  board?: Card[];
}

const randomCards = (n: number): Card[] => shuffleDeck(createDeck()).slice(0, n);

export const nextDrillSpot = (mode: Mode): DrillSpot | null => {
  if (mode === 'preflop-trainer') {
    const cards = randomCards(2);
    return {
      prompt: 'Preflop decision spot: Fold / Open / 3-bet / Call',
      choices: ['Fold', 'Open', '3-bet', 'Call'],
      answer: cards[0].rank === cards[1].rank || ['A','K','Q'].includes(cards[0].rank) ? 'Open' : 'Fold',
      note: 'Heuristic only: tighten early, widen late position opens.',
      heroCards: cards
    };
  }
  if (mode === 'cbet-trainer') {
    return {
      prompt: 'Flop spot: c-bet small, c-bet big, or check?',
      choices: ['c-bet 33%', 'c-bet 75%', 'check'],
      answer: Math.random() > 0.5 ? 'c-bet 33%' : 'check',
      note: 'Dry boards favor small c-bets; wet boards often mix checks.',
      heroCards: randomCards(2),
      board: randomCards(3)
    };
  }
  if (mode === 'blind-defense') {
    return {
      prompt: 'Blind defense spot vs late-position raise',
      choices: ['Fold', 'Call', '3-bet'],
      answer: 'Call',
      note: 'Defend reasonably wide in BB with playable suited/connected hands.',
      heroCards: randomCards(2)
    };
  }
  return null;
};
