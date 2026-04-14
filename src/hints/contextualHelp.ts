import { StrategyMode } from '../strategy/types';

export const strategyModeHelp: Record<StrategyMode, string> = {
  exploit: 'Exploit Mode adapts to leaks: value bet thinner vs callers and bluff less into sticky ranges.',
  blueprint: 'Blueprint Mode follows balanced baseline play, useful for building fundamentals.'
};

export const paceHelp = {
  Fast: 'Quick rhythm for volume reps.',
  Normal: 'Balanced speed for regular study.',
  Study: 'Extra pause time for reading spots and notes.'
} as const;

export const ratingHelp: Record<'good' | 'reasonable' | 'questionable' | 'punt', string> = {
  good: 'Strong line for the spot. Keep repeating this pattern.',
  reasonable: 'Solid enough, but another line may earn more long-term EV.',
  questionable: 'Understandable choice, but it likely gives away value or folds too much EV.',
  punt: 'High-cost error. Review this node and tighten your decision rules.'
};

export const helpSections = [
  {
    title: 'What this app is',
    bullets: ['A poker study tool for hand practice.', 'Not a gambling game.', 'Built for repeatable decision training and review.']
  },
  {
    title: 'Main modes',
    bullets: ['Full Ring Loop: play complete hands.', 'Preflop Trainer: opening and facing-open reps.', 'C-Bet Trainer: flop sizing/check decisions.', 'Blind Defense Trainer: defend vs late opens.', 'Replay Last Hand: step-by-step review.']
  },
  {
    title: 'Strategy modes',
    bullets: ['Exploit Mode: adjust to villain leaks.', 'Blueprint Mode: balanced baseline defaults.']
  },
  {
    title: 'Pace controls',
    bullets: ['Fast = faster flow.', 'Normal = default timing.', 'Study = slower reveals for readability.']
  },
  {
    title: 'Study recap',
    bullets: ['Rating grades the line quality for the hand.', 'Coach notes explain why the line worked or leaked.', 'Use recap trends to target your next drill reps.']
  },
  {
    title: 'Hints',
    bullets: ['Use Quick Hint for a short nudge before acting.', 'Use Explain More for context: texture, range, and mode logic.']
  }
];
