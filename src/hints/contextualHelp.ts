import { StrategyMode } from '../strategy/types';

export const strategyModeHelp: Record<StrategyMode, string> = {
  exploit: 'Adaptive Pressure leans into leaks: value bet thinner versus callers and pressure overfolders more directly.',
  blueprint: 'Sound Fundamentals follows balanced baseline play and keeps your ranges disciplined.'
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
    title: 'What this room is',
    bullets: ['A single-player poker room for full-hand table practice.', 'Built for repeatable hand review, not gambling.', 'Designed around live decision flow, recap, and opponent study.']
  },
  {
    title: 'Main spaces',
    bullets: ['Table Practice is the main experience: play complete hands against archetype bots.', 'Replay Last Hand lets you review the previous hand street by street.', 'Hints remain optional so the table still feels natural first.']
  },
  {
    title: 'Strategy policies',
    bullets: ['Adaptive Pressure: adjust to visible leaks and punish weak habits.', 'Sound Fundamentals: train around stable baseline decisions and range discipline.']
  },
  {
    title: 'Pace controls',
    bullets: ['Fast keeps the room moving.', 'Normal is the default balance.', 'Study slows reveals so you can read the table more comfortably.']
  },
  {
    title: 'Study recap',
    bullets: ['Recap grades the line quality of the completed hand.', 'Coach notes explain where discipline held and where pressure leaked value.', 'Session analytics focus on hands played, net bb, and recurring patterns.']
  },
  {
    title: 'Hints',
    bullets: ['Use Coaching Hint for a short nudge before acting.', 'Open Study Note for texture, range, and policy context only when you want deeper guidance.']
  }
];
