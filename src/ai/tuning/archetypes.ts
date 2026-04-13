import { buildRangeSet, Position, RangeSpot } from './ranges';

export type Archetype = 'Nit'|'TAG'|'LAG'|'Calling Station'|'Maniac';

export interface StreetTendencies {
  bluffFreq: number;
  barrelFreq: number;
  callDown: number;
  raiseValueBias: number;
}

export interface ArchetypeProfile {
  name: Archetype;
  ranges: Record<Position, Record<RangeSpot, Set<string>>>;
  cbetBase: { dry: number; semiWet: number; wet: number; multiwayPenalty: number };
  street: { flop: StreetTendencies; turn: StreetTendencies; river: StreetTendencies };
  aggression: number;
}

const makePositionRanges = (r: Record<Position, Record<RangeSpot, string[]>>) => {
  const out = {} as Record<Position, Record<RangeSpot, Set<string>>>;
  (Object.keys(r) as Position[]).forEach((pos) => {
    out[pos] = {
      openRaise: buildRangeSet(r[pos].openRaise),
      flatVsOpen: buildRangeSet(r[pos].flatVsOpen),
      threeBetVsOpen: buildRangeSet(r[pos].threeBetVsOpen),
      fourBetContinue: buildRangeSet(r[pos].fourBetContinue),
      blindDefense: buildRangeSet(r[pos].blindDefense),
      continueVsThreeBet: buildRangeSet(r[pos].continueVsThreeBet)
    };
  });
  return out;
};

export const archetypes: Record<Archetype, ArchetypeProfile> = {
  Nit: {
    name: 'Nit',
    ranges: makePositionRanges({
      UTG: { openRaise:['88+','AQs+','AKo'], flatVsOpen:['JJ-88','AQs','KQs'], threeBetVsOpen:['QQ+','AKs','AKo'], fourBetContinue:['KK+','AKs'], blindDefense:['AQs+','TT+'], continueVsThreeBet:['QQ+','AK'] },
      HJ: { openRaise:['77+','AJs+','KQs','AQo+'], flatVsOpen:['99-77','ATs+','KQs'], threeBetVsOpen:['QQ+','AK'], fourBetContinue:['KK+','AKs'], blindDefense:['AJs+','TT+'], continueVsThreeBet:['QQ+','AK'] },
      CO: { openRaise:['66+','ATs+','KJs+','QJs','AJo+'], flatVsOpen:['88-66','ATs+','KQs'], threeBetVsOpen:['JJ+','AQs+','AKo'], fourBetContinue:['KK+','AKs'], blindDefense:['ATs+','99+'], continueVsThreeBet:['QQ+','AK'] },
      BTN: { openRaise:['55+','A8s+','KTs+','QTs+','JTs','ATo+','KQo'], flatVsOpen:['77+','ATs+','KJs+','QJs'], threeBetVsOpen:['JJ+','AQs+','AKo'], fourBetContinue:['KK+','AKs'], blindDefense:['A9s+','88+','KTs+'], continueVsThreeBet:['QQ+','AK'] },
      SB: { openRaise:['66+','A9s+','KTs+','QTs+','AJo+'], flatVsOpen:['88+','ATs+'], threeBetVsOpen:['JJ+','AQs+','AKo'], fourBetContinue:['KK+','AKs'], blindDefense:['A9s+','99+'], continueVsThreeBet:['QQ+','AK'] },
      BB: { openRaise:['88+','AJs+','KQs','AQo+'], flatVsOpen:['66+','ATs+','KJs+','QJs'], threeBetVsOpen:['QQ+','AK'], fourBetContinue:['KK+','AKs'], blindDefense:['22+','A2s+','K9s+','QTs+','JTs','AJo+'], continueVsThreeBet:['QQ+','AK'] }
    }),
    cbetBase:{dry:0.56,semiWet:0.35,wet:0.22,multiwayPenalty:0.18},
    street:{flop:{bluffFreq:0.08,barrelFreq:0.3,callDown:0.25,raiseValueBias:0.8},turn:{bluffFreq:0.06,barrelFreq:0.25,callDown:0.2,raiseValueBias:0.9},river:{bluffFreq:0.04,barrelFreq:0.2,callDown:0.15,raiseValueBias:0.95}},
    aggression:0.35
  },
  TAG: {
    name:'TAG',
    ranges: makePositionRanges({
      UTG:{openRaise:['66+','ATs+','KQs','AQo+'],flatVsOpen:['99-66','AJs','KQs'],threeBetVsOpen:['QQ+','AK','A5s'],fourBetContinue:['QQ+','AK'],blindDefense:['ATs+','99+','KQs'],continueVsThreeBet:['JJ+','AQs+','AKo']},
      HJ:{openRaise:['55+','A9s+','KTs+','QTs+','AJo+'],flatVsOpen:['88-55','ATs+','KQs','QJs'],threeBetVsOpen:['JJ+','AQ+','A5s-A4s'],fourBetContinue:['QQ+','AK'],blindDefense:['A9s+','88+','KJs+'],continueVsThreeBet:['JJ+','AQ+']},
      CO:{openRaise:['44+','A7s+','K9s+','Q9s+','JTs','ATo+','KQo'],flatVsOpen:['66+','A9s+','KTs+','QTs+'],threeBetVsOpen:['TT+','AQ+','A5s-A3s'],fourBetContinue:['QQ+','AK'],blindDefense:['A7s+','66+','KTs+','QTs+'],continueVsThreeBet:['TT+','AQ+']},
      BTN:{openRaise:['22+','A2s+','K7s+','Q8s+','J8s+','T8s+','98s','A9o+','KTo+'],flatVsOpen:['55+','A7s+','KTs+','QTs+','JTs','T9s'],threeBetVsOpen:['99+','AQ+','A5s-A2s','KQs'],fourBetContinue:['QQ+','AK'],blindDefense:['A2s+','44+','K8s+','Q9s+','J9s+'],continueVsThreeBet:['TT+','AQ+','AJs']},
      SB:{openRaise:['33+','A2s+','K8s+','Q9s+','J9s+','T8s+','A9o+','KTo+'],flatVsOpen:['66+','A8s+','KTs+'],threeBetVsOpen:['TT+','AQ+','A5s-A2s'],fourBetContinue:['QQ+','AK'],blindDefense:['A2s+','44+','K9s+','QTs+','JTs'],continueVsThreeBet:['TT+','AQ+']},
      BB:{openRaise:['55+','ATs+','KTs+','QTs+','AJo+'],flatVsOpen:['22+','A2s+','K7s+','Q8s+','J8s+','T8s+','98s','A9o+'],threeBetVsOpen:['TT+','AQ+','A5s-A2s','KQs'],fourBetContinue:['QQ+','AK'],blindDefense:['22+','A2s+','K5s+','Q7s+','J8s+','T8s+','97s+','A8o+','KTo+'],continueVsThreeBet:['99+','AQ+']}
    }),
    cbetBase:{dry:0.68,semiWet:0.5,wet:0.36,multiwayPenalty:0.2},
    street:{flop:{bluffFreq:0.2,barrelFreq:0.48,callDown:0.38,raiseValueBias:0.7},turn:{bluffFreq:0.14,barrelFreq:0.42,callDown:0.34,raiseValueBias:0.75},river:{bluffFreq:0.1,barrelFreq:0.33,callDown:0.3,raiseValueBias:0.8}},
    aggression:0.62
  },
  LAG: {
    name:'LAG',
    ranges: makePositionRanges({
      UTG:{openRaise:['55+','A8s+','KTs+','QTs+','JTs','ATo+'],flatVsOpen:['77+','ATs+','KQs','QJs'],threeBetVsOpen:['JJ+','AQ+','A5s-A2s','KQs'],fourBetContinue:['QQ+','AK'],blindDefense:['A8s+','77+','KTs+'],continueVsThreeBet:['TT+','AQ+','AJs','KQs']},
      HJ:{openRaise:['44+','A5s+','K9s+','Q9s+','J9s+','T9s','A9o+','KQo'],flatVsOpen:['66+','A8s+','KTs+','QTs+','JTs'],threeBetVsOpen:['TT+','AQ+','A5s-A2s','KJs+'],fourBetContinue:['QQ+','AK','A5s'],blindDefense:['A5s+','55+','K9s+','Q9s+'],continueVsThreeBet:['99+','AQ+','AJs+']},
      CO:{openRaise:['22+','A2s+','K6s+','Q7s+','J8s+','T8s+','97s+','A8o+','KTo+'],flatVsOpen:['55+','A6s+','K9s+','Q9s+','J9s+','T9s'],threeBetVsOpen:['88+','AT+','A5s-A2s','KTs+','QJs'],fourBetContinue:['JJ+','AQ+','A5s'],blindDefense:['A2s+','33+','K7s+','Q8s+','J8s+'],continueVsThreeBet:['88+','AJ+','KQs']},
      BTN:{openRaise:['22+','A2s+','K2s+','Q5s+','J7s+','T7s+','96s+','86s+','75s+','64s+','A2o+','K8o+','Q9o+','J9o+'],flatVsOpen:['44+','A2s+','K7s+','Q8s+','J8s+','T8s+','97s+','A8o+'],threeBetVsOpen:['77+','AT+','A5s-A2s','KTs+','QTs+','JTs'],fourBetContinue:['JJ+','AQ+','A5s'],blindDefense:['A2s+','22+','K5s+','Q7s+','J8s+','T8s+'],continueVsThreeBet:['88+','AT+','AJs','KQs']},
      SB:{openRaise:['22+','A2s+','K5s+','Q7s+','J8s+','T8s+','97s+','A8o+','KTo+','QTo+'],flatVsOpen:['55+','A5s+','K9s+','Q9s+'],threeBetVsOpen:['88+','AJ+','A5s-A2s','KTs+'],fourBetContinue:['JJ+','AQ+'],blindDefense:['A2s+','22+','K6s+','Q8s+','J8s+'],continueVsThreeBet:['88+','AT+','KQs']},
      BB:{openRaise:['44+','A8s+','KTs+','QTs+','AJo+'],flatVsOpen:['22+','A2s+','K4s+','Q6s+','J7s+','T7s+','97s+','87s','76s','A5o+','K9o+'],threeBetVsOpen:['88+','AJ+','A5s-A2s','KTs+','QJs'],fourBetContinue:['JJ+','AQ+'],blindDefense:['22+','A2s+','K2s+','Q4s+','J6s+','T7s+','96s+','86s+','75s+','64s+','A2o+','K8o+','Q9o+'],continueVsThreeBet:['77+','AT+','AJs+']}
    }),
    cbetBase:{dry:0.77,semiWet:0.62,wet:0.5,multiwayPenalty:0.15},
    street:{flop:{bluffFreq:0.3,barrelFreq:0.58,callDown:0.42,raiseValueBias:0.55},turn:{bluffFreq:0.24,barrelFreq:0.52,callDown:0.4,raiseValueBias:0.58},river:{bluffFreq:0.18,barrelFreq:0.43,callDown:0.36,raiseValueBias:0.62}},
    aggression:0.78
  },
  'Calling Station': {
    name:'Calling Station',
    ranges: makePositionRanges({
      UTG:{openRaise:['77+','ATs+','KQs','AQo+'],flatVsOpen:['22+','A2s+','KTs+','QTs+','JTs','A9o+'],threeBetVsOpen:['QQ+','AK'],fourBetContinue:['KK+','AK'],blindDefense:['ATs+','66+'],continueVsThreeBet:['QQ+','AK']},
      HJ:{openRaise:['66+','A9s+','KTs+','QTs+','AJo+'],flatVsOpen:['22+','A2s+','K9s+','Q9s+','J9s+','T9s','A8o+'],threeBetVsOpen:['QQ+','AK'],fourBetContinue:['KK+','AK'],blindDefense:['A8s+','55+','KTs+'],continueVsThreeBet:['JJ+','AQ+']},
      CO:{openRaise:['55+','A7s+','K9s+','Q9s+','J9s+','T9s','A9o+','KTo+'],flatVsOpen:['22+','A2s+','K7s+','Q8s+','J8s+','T8s+','97s+','A7o+'],threeBetVsOpen:['KK+','AK'],fourBetContinue:['KK+','AK'],blindDefense:['A2s+','22+','K8s+','Q9s+'],continueVsThreeBet:['JJ+','AQ+']},
      BTN:{openRaise:['44+','A2s+','K6s+','Q8s+','J8s+','T8s+','97s+','A8o+','KTo+'],flatVsOpen:['22+','A2s+','K4s+','Q6s+','J7s+','T7s+','97s+','A5o+','K9o+'],threeBetVsOpen:['QQ+','AK'],fourBetContinue:['KK+','AK'],blindDefense:['A2s+','22+','K5s+','Q7s+','J8s+'],continueVsThreeBet:['TT+','AQ+']},
      SB:{openRaise:['55+','A7s+','K9s+','Q9s+','J9s+','A9o+'],flatVsOpen:['22+','A2s+','K7s+','Q8s+','J8s+','T8s+'],threeBetVsOpen:['QQ+','AK'],fourBetContinue:['KK+','AK'],blindDefense:['A2s+','22+','K8s+','Q9s+'],continueVsThreeBet:['TT+','AQ+']},
      BB:{openRaise:['66+','ATs+','KTs+','QTs+','AJo+'],flatVsOpen:['22+','A2s+','K2s+','Q4s+','J6s+','T7s+','96s+','86s+','75s+','64s+','A2o+','K8o+','Q9o+'],threeBetVsOpen:['QQ+','AK'],fourBetContinue:['KK+','AK'],blindDefense:['22+','A2s+','K2s+','Q4s+','J6s+','T7s+','96s+','86s+','75s+','64s+','A2o+','K8o+','Q9o+'],continueVsThreeBet:['TT+','AQ+']}
    }),
    cbetBase:{dry:0.42,semiWet:0.28,wet:0.18,multiwayPenalty:0.22},
    street:{flop:{bluffFreq:0.04,barrelFreq:0.22,callDown:0.72,raiseValueBias:0.86},turn:{bluffFreq:0.03,barrelFreq:0.18,callDown:0.74,raiseValueBias:0.9},river:{bluffFreq:0.02,barrelFreq:0.12,callDown:0.78,raiseValueBias:0.94}},
    aggression:0.24
  },
  Maniac: {
    name:'Maniac',
    ranges: makePositionRanges({
      UTG:{openRaise:['22+','A2s+','K7s+','Q8s+','J8s+','T8s+','97s+','A8o+','KTo+'],flatVsOpen:['22+','A2s+','K7s+','Q8s+','J8s+','T8s+','A8o+'],threeBetVsOpen:['77+','AT+','A5s-A2s','KTs+','QTs+'],fourBetContinue:['TT+','AQ+','A5s'],blindDefense:['22+','A2s+','K8s+','Q9s+'],continueVsThreeBet:['77+','AT+','KQs']},
      HJ:{openRaise:['22+','A2s+','K5s+','Q7s+','J8s+','T8s+','97s+','86s+','A7o+','KTo+'],flatVsOpen:['22+','A2s+','K5s+','Q7s+','J8s+','T8s+','A7o+'],threeBetVsOpen:['66+','AT+','A5s-A2s','KTs+','QTs+','JTs'],fourBetContinue:['TT+','AQ+','A5s'],blindDefense:['22+','A2s+','K6s+','Q8s+','J8s+'],continueVsThreeBet:['66+','AT+','KQs']},
      CO:{openRaise:['22+','A2s+','K2s+','Q5s+','J7s+','T7s+','96s+','86s+','75s+','A2o+','K8o+','Q9o+'],flatVsOpen:['22+','A2s+','K4s+','Q6s+','J7s+','T7s+','97s+','A5o+'],threeBetVsOpen:['55+','A9+','A5s-A2s','K9s+','QTs+','JTs'],fourBetContinue:['99+','AQ+','A5s'],blindDefense:['22+','A2s+','K4s+','Q6s+','J7s+'],continueVsThreeBet:['55+','A9+','KQs']},
      BTN:{openRaise:['22+','A2s+','K2s+','Q2s+','J5s+','T6s+','95s+','85s+','74s+','63s+','52s+','A2o+','K5o+','Q8o+','J8o+'],flatVsOpen:['22+','A2s+','K2s+','Q5s+','J7s+','T7s+','96s+','86s+','A2o+','K8o+'],threeBetVsOpen:['44+','A8+','A5s-A2s','K9s+','QTs+','JTs','T9s'],fourBetContinue:['99+','AQ+','A5s'],blindDefense:['22+','A2s+','K2s+','Q5s+','J7s+'],continueVsThreeBet:['44+','A8+','KQs']},
      SB:{openRaise:['22+','A2s+','K2s+','Q5s+','J7s+','T7s+','96s+','86s+','75s+','64s+','A5o+','K8o+','Q9o+'],flatVsOpen:['22+','A2s+','K4s+','Q6s+','J7s+','T7s+'],threeBetVsOpen:['55+','A9+','A5s-A2s','KTs+','QTs+'],fourBetContinue:['99+','AQ+'],blindDefense:['22+','A2s+','K4s+','Q6s+','J7s+'],continueVsThreeBet:['55+','A9+','KQs']},
      BB:{openRaise:['55+','A8s+','KTs+','QTs+','AJo+'],flatVsOpen:['22+','A2s+','K2s+','Q2s+','J5s+','T6s+','95s+','85s+','74s+','63s+','52s+','A2o+','K5o+','Q8o+','J8o+'],threeBetVsOpen:['55+','A9+','A5s-A2s','K9s+','QTs+','JTs','T9s'],fourBetContinue:['99+','AQ+'],blindDefense:['22+','A2s+','K2s+','Q2s+','J5s+','T6s+','95s+','85s+','74s+','63s+','52s+','A2o+','K5o+','Q8o+','J8o+'],continueVsThreeBet:['55+','A9+','KQs']}
    }),
    cbetBase:{dry:0.86,semiWet:0.75,wet:0.62,multiwayPenalty:0.1},
    street:{flop:{bluffFreq:0.42,barrelFreq:0.7,callDown:0.5,raiseValueBias:0.4},turn:{bluffFreq:0.35,barrelFreq:0.66,callDown:0.46,raiseValueBias:0.45},river:{bluffFreq:0.28,barrelFreq:0.58,callDown:0.4,raiseValueBias:0.5}},
    aggression:0.92
  }
};
