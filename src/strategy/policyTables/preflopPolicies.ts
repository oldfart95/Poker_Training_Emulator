import { Position } from '../../ai/tuning/ranges';

export interface PreflopPolicyRow {
  openRaise: number;
  defendVsOpen: number;
  threeBetVsOpen: number;
  continueVsThreeBet: number;
  blindDefense: number;
}

export const preflopPolicyTables: Record<Position, PreflopPolicyRow> = {
  UTG: { openRaise: 0.18, defendVsOpen: 0.1, threeBetVsOpen: 0.04, continueVsThreeBet: 0.34, blindDefense: 0 },
  HJ: { openRaise: 0.22, defendVsOpen: 0.14, threeBetVsOpen: 0.05, continueVsThreeBet: 0.38, blindDefense: 0 },
  CO: { openRaise: 0.29, defendVsOpen: 0.18, threeBetVsOpen: 0.08, continueVsThreeBet: 0.41, blindDefense: 0 },
  BTN: { openRaise: 0.44, defendVsOpen: 0.26, threeBetVsOpen: 0.11, continueVsThreeBet: 0.45, blindDefense: 0 },
  SB: { openRaise: 0.38, defendVsOpen: 0.2, threeBetVsOpen: 0.12, continueVsThreeBet: 0.43, blindDefense: 0.22 },
  BB: { openRaise: 0.08, defendVsOpen: 0.34, threeBetVsOpen: 0.09, continueVsThreeBet: 0.4, blindDefense: 0.38 }
};
