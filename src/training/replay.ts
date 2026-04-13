import { ActionRecord, HandSummary, Player } from '../engine/types';

export interface ReplayStep {
  who: string;
  did: string;
  potAfter: number;
  interpretation: string;
  street: string;
}

const actionTone = (action: ActionRecord): 'value-heavy' | 'wide' | 'passive' | 'sticky' | 'overaggressive' => {
  if (action.type === 'raise' || action.type === 'all-in') return action.amount > 0 ? 'overaggressive' : 'value-heavy';
  if (action.type === 'call') return 'sticky';
  if (action.type === 'check') return 'passive';
  return 'wide';
};

const archetypeRead = (profile: string | undefined): string => {
  if (!profile) return 'baseline';
  if (profile === 'Nit') return 'value-heavy';
  if (profile === 'Calling Station') return 'sticky';
  if (profile === 'Maniac') return 'overaggressive';
  if (profile === 'LAG') return 'wide';
  return 'passive';
};

export const formatReplaySteps = (summary: HandSummary | undefined, players: Player[]): ReplayStep[] => {
  if (!summary) return [];
  let pot = summary.startingPot;

  return summary.actions.map((action) => {
    pot += action.amount;
    const player = players.find((p) => p.seat === action.seat);
    const tone = actionTone(action);
    const profileLean = archetypeRead(player?.profile);

    return {
      who: action.playerName,
      did: `${action.type.toUpperCase()}${action.amount ? ` ${action.amount}` : ''}`,
      potAfter: pot,
      street: action.street.toUpperCase(),
      interpretation: `${tone} line in this node; ${player?.name ?? action.playerName} trends ${profileLean} here.`
    };
  });
};
