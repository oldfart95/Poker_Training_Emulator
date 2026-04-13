import { Archetype } from './tuning/archetypes';

export const botProfiles: Archetype[] = ['Nit', 'TAG', 'LAG', 'Calling Station', 'Maniac'];
export interface BotProfile {
  name: 'Nit'|'TAG'|'LAG'|'Calling Station'|'Maniac';
  vpip: number;
  pfr: number;
  threeBet: number;
  cbet: number;
  bluff: number;
  callDown: number;
  aggression: number;
}

export const botProfiles: BotProfile[] = [
  { name: 'Nit', vpip: 0.15, pfr: 0.12, threeBet: 0.03, cbet: 0.45, bluff: 0.08, callDown: 0.2, aggression: 0.35 },
  { name: 'TAG', vpip: 0.23, pfr: 0.19, threeBet: 0.07, cbet: 0.58, bluff: 0.18, callDown: 0.35, aggression: 0.6 },
  { name: 'LAG', vpip: 0.34, pfr: 0.29, threeBet: 0.12, cbet: 0.7, bluff: 0.3, callDown: 0.4, aggression: 0.78 },
  { name: 'Calling Station', vpip: 0.38, pfr: 0.12, threeBet: 0.02, cbet: 0.4, bluff: 0.05, callDown: 0.75, aggression: 0.2 },
  { name: 'Maniac', vpip: 0.5, pfr: 0.42, threeBet: 0.2, cbet: 0.82, bluff: 0.45, callDown: 0.5, aggression: 0.9 }
];
