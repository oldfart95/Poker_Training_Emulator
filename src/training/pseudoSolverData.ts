export interface SolverSource {
  label: string;
  url: string;
  updated: string;
  scope: string;
}

export const solverSources: SolverSource[] = [
  {
    label: 'GGPoker free 6-max preflop charts',
    url: 'https://www.ggpoker.gg/',
    updated: '2026-04-13',
    scope: 'Public 6-max preflop matrix baselines'
  },
  {
    label: 'FreeBetRange 6-max open-raise guide',
    url: 'https://help.freebetrange.com/guides/Preflop_Charts_-_Open_Raises_in_6max_Cash_Games.pdf',
    updated: '2026-04-13',
    scope: 'RFI position widths and simplifications'
  },
  {
    label: 'Upswing c-bet sizing heuristics',
    url: 'https://upswingpoker.com/c-bet-sizing-strategy-continuation-bet/',
    updated: '2026-04-13',
    scope: 'Texture-driven small-vs-large c-bet guidance'
  },
  {
    label: 'Upswing wet-vs-dry sizing rule of thumb',
    url: 'https://upswingpoker.com/bet-size-strategy-tips-rules/',
    updated: '2026-04-13',
    scope: 'Dry boards small sizing, wet boards larger sizing'
  },
  {
    label: 'BeyondGTO dry-board c-bet frequencies',
    url: 'https://beyondgto.com/guides/how-to-c-bet-on-dry-boards',
    updated: '2026-04-13',
    scope: 'Practical dry-board c-bet frequencies and sizing'
  }
];

export const rfiTargetPct: Record<'UTG'|'HJ'|'CO'|'BTN'|'SB'|'BB', number> = {
  UTG: 18,
  HJ: 22,
  CO: 30,
  BTN: 46,
  SB: 38,
  BB: 0
};

export const blindDefenseTargets = {
  bbVsBtn: { defendPct: 48, threeBetPct: 14 },
  bbVsCo: { defendPct: 41, threeBetPct: 11 },
  sbVsBtn: { defendPct: 28, threeBetPct: 13 },
  sbVsCo: { defendPct: 24, threeBetPct: 10 }
};

export const cBetTargets = {
  dry: { small: 0.64, big: 0.12, check: 0.24 },
  semiWet: { small: 0.48, big: 0.27, check: 0.25 },
  wet: { small: 0.26, big: 0.39, check: 0.35 }
};

export const confidenceFromFrequency = (frequency: number): 'High'|'Medium'|'Low' => {
  if (frequency >= 0.55) return 'High';
  if (frequency >= 0.3) return 'Medium';
  return 'Low';
};
