import { Mode } from '../engine/types';

export const ONBOARDING_DISMISS_KEY = 'ppp:onboarding-dismissed-v1';
export const LIABILITY_DISCLAIMER_DISMISS_KEY = 'ppp:liability-disclaimer-dismissed-v1';

export const welcomeChecklist = [
  'Start with Deal Next Hand to generate your first spot.',
  'Switch modes in the top bar if you want focused drills.',
  'Use Hint any time you are unsure before acting.',
  'Study Recap explains your decisions after each hand.'
];

export const trainerInstructions: Record<Exclude<Mode, 'full-ring'>, { title: string; body: string }> = {
  'preflop-trainer': {
    title: 'Preflop Decision Trainer',
    body: 'Choose Fold / Open / 3-bet / Call based on position and who entered the pot first.'
  },
  'cbet-trainer': {
    title: 'C-Bet Trainer',
    body: 'Choose check, a small c-bet, or a large c-bet. Focus on board texture and range advantage.'
  },
  'blind-defense': {
    title: 'Blind Defense Trainer',
    body: 'Defend versus a late-position open. Prioritize playability because you are out of position.'
  },
  replay: {
    title: 'Replay Last Hand',
    body: 'Step through your previous hand to study the line. Commentary changes with Exploit vs Blueprint mode.'
  }
};
