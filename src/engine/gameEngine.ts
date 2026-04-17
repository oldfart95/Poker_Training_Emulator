import { decideBotAction, DecisionDebug } from '../ai/decision';
import { botArchetypes } from '../ai/botProfiles';
import { rateHand } from '../training/coach';
import { Position } from '../ai/tuning/ranges';
import { Archetype } from '../ai/tuning/archetypes';
import { StrategyMode } from '../strategy/types';
import { createDeck, shuffleDeck } from './deck';
import { compareHands, evaluateBestHand } from './handEvaluator';
import { validateHand } from './handValidator';
import { ActionRecord, ActionType, Card, HandSummary, LegalActionsSnapshot, Player, SessionStats, Street } from './types';

export const ENGINE_VERSION = '2.0.0';

export interface SeatLegalActions {
  availableActions: ActionType[];
  toCall: number;
  minRaise: number;
  max: number;
  canCheck: boolean;
  canFold: boolean;
  canCall: boolean;
  canBet: boolean;
  canRaise: boolean;
  canAllIn: boolean;
  minBetOrRaiseTo: number | null;
  currentBet: number;
  minRaiseSize: number;
}

export interface GameState {
  handId: number;
  players: Player[];
  board: Card[];
  previousBoard: Card[];
  deck: Card[];
  pot: number;
  dealer: number;
  sb: number;
  bb: number;
  currentBet: number;
  minRaiseSize: number;
  currentSeat: number;
  street: Street;
  actions: ActionRecord[];
  lastAggressor: number;
  waitingForHero: boolean;
  summary?: HandSummary;
  heroStackAtHandStart: number;
  handStartingPot: number;
  stats: SessionStats;
  botDebug?: DecisionDebug;
  strategyMode: StrategyMode;
  smallBlindSeat: number;
  bigBlindSeat: number;
  pendingSeats: number[];
  actedSinceLastFullRaise: number[];
  handStartStacks: Record<string, number>;
  activeSeatsAtHandStart: number[];
  handIntegrity: 'valid' | 'invalid';
  integrityErrors: string[];
}

export interface BotTurnResult {
  state: GameState;
  decision: ReturnType<typeof decideBotAction>;
}

const POSITIONS_BY_COUNT: Record<number, string[]> = {
  2: ['BTN', 'BB'],
  3: ['BTN', 'SB', 'BB'],
  4: ['BTN', 'SB', 'BB', 'UTG'],
  5: ['BTN', 'SB', 'BB', 'UTG', 'CO'],
  6: ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO']
};

const DEV_VALIDATE = true;
const nowIso = () => new Date().toISOString();

export const initialStats = (): SessionStats => ({
  hands: 0, vpipOpportunities: 0, vpipCount: 0, pfrOpportunities: 0, pfrCount: 0,
  threeBetOpportunities: 0, threeBetCount: 0, foldToThreeBetOpportunities: 0, foldToThreeBetCount: 0,
  cBetOpportunities: 0, cBetCount: 0, wtsdCount: 0, biggestWinBb: 0, biggestPuntBb: 0, winLossBb: 0,
  mistakes: { 'too loose preflop': 0, 'passive error': 0, 'bad call': 0, 'bad bluff': 0, 'overvalue hand': 0 }
});

const buildPlayer = (seat: number): Player => ({
  id: `p${seat}`,
  name: seat === 0 ? 'Hero' : botArchetypes[seat - 1],
  isHero: seat === 0,
  stack: 10000,
  holeCards: [],
  folded: false,
  allIn: false,
  betThisStreet: 0,
  totalContributed: 0,
  seat,
  position: '',
  busted: false,
  profile: seat === 0 ? undefined : botArchetypes[seat - 1]
});

export const createInitialState = (): GameState => ({
  handId: 0,
  players: Array.from({ length: 6 }, (_, seat) => buildPlayer(seat)),
  board: [],
  previousBoard: [],
  deck: [],
  pot: 0,
  dealer: 0,
  sb: 50,
  bb: 100,
  currentBet: 0,
  minRaiseSize: 100,
  currentSeat: -1,
  street: 'preflop',
  actions: [],
  lastAggressor: -1,
  waitingForHero: false,
  summary: undefined,
  heroStackAtHandStart: 10000,
  handStartingPot: 0,
  stats: initialStats(),
  botDebug: undefined,
  strategyMode: 'exploit',
  smallBlindSeat: -1,
  bigBlindSeat: -1,
  pendingSeats: [],
  actedSinceLastFullRaise: [],
  handStartStacks: {},
  activeSeatsAtHandStart: [],
  handIntegrity: 'valid',
  integrityErrors: []
});

const cloneState = (state: GameState) => structuredClone(state);
const seatKey = (seat: number) => String(seat);
const activeTableSeats = (state: GameState) => state.players.filter((player) => player.stack > 0).map((player) => player.seat);
const livePlayers = (state: GameState) => state.players.filter((player) => !player.folded && player.totalContributed >= 0 && (player.stack > 0 || player.totalContributed > 0));
const actingPlayers = (state: GameState) => state.players.filter((player) => !player.folded && !player.allIn && player.stack > 0);
const stackMap = (players: Player[]) => Object.fromEntries(players.map((player) => [seatKey(player.seat), player.stack]));

const seatOrder = (state: GameState, startSeat: number, seats?: number[]) => {
  const allowed = new Set(seats ?? state.players.map((player) => player.seat));
  const order: number[] = [];
  for (let offset = 0; offset < state.players.length; offset += 1) {
    const seat = (startSeat + offset) % state.players.length;
    if (allowed.has(seat)) order.push(seat);
  }
  return order;
};

const nextSeatWithChips = (state: GameState, from: number) => {
  const seats = activeTableSeats(state);
  if (seats.length === 0) return -1;
  for (let offset = 1; offset <= state.players.length; offset += 1) {
    const seat = (from + offset) % state.players.length;
    if (seats.includes(seat)) return seat;
  }
  return seats[0];
};

const assignPositions = (state: GameState, buttonSeat: number, activeSeats: number[]) => {
  const labels = POSITIONS_BY_COUNT[activeSeats.length] ?? POSITIONS_BY_COUNT[6];
  const order = seatOrder(state, buttonSeat, activeSeats);
  state.players.forEach((player) => {
    player.position = '';
  });
  order.forEach((seat, index) => {
    state.players[seat].position = labels[index] ?? `Seat ${seat}`;
  });
};

const buildPendingSeats = (state: GameState, firstSeat: number, excludedSeat = -1) => seatOrder(
  state,
  firstSeat,
  actingPlayers(state).map((player) => player.seat).filter((seat) => seat !== excludedSeat)
);

const getFirstToActPreflop = (state: GameState, activeSeats: number[]) => (
  activeSeats.length === 2 ? state.smallBlindSeat : nextSeatWithChips(state, state.bigBlindSeat)
);

const getFirstToActPostflop = (state: GameState) => nextSeatWithChips(state, state.dealer);

const makeLegalSnapshot = (state: GameState, seat: number, legal: SeatLegalActions): LegalActionsSnapshot => ({
  actorSeat: seat,
  street: state.street,
  canFold: legal.canFold,
  canCheck: legal.canCheck,
  canCall: legal.canCall,
  canBet: legal.canBet,
  canRaise: legal.canRaise,
  canAllIn: legal.canAllIn,
  amountToCall: legal.toCall,
  currentBet: legal.currentBet,
  minRaiseSize: legal.minRaiseSize,
  minBetOrRaiseTo: legal.minBetOrRaiseTo,
  maxToAmount: legal.max
});

const pushAction = (
  state: GameState,
  player: Player,
  type: ActionType,
  amount: number,
  toAmount: number,
  potBefore: number,
  stackBefore: number,
  amountToCallBefore: number,
  legalActionsSnapshot: LegalActionsSnapshot | undefined,
  note?: string
) => {
  state.actions.push({
    actionIndex: state.actions.length,
    timestamp: nowIso(),
    seat: player.seat,
    playerName: player.name,
    street: state.street,
    type,
    amount,
    toAmount,
    potBefore,
    potAfter: state.pot,
    stackBefore,
    stackAfter: player.stack,
    amountToCallBefore,
    amountToCallAfter: Math.max(0, state.currentBet - player.betThisStreet),
    isAllIn: player.stack === 0 || type === 'all_in',
    legalActionsSnapshot,
    note
  });
};

const postBlind = (state: GameState, seat: number, amount: number, note: string) => {
  const player = state.players[seat];
  if (player.stack <= 0) return;
  const paid = Math.min(amount, player.stack);
  const potBefore = state.pot;
  const stackBefore = player.stack;
  player.stack -= paid;
  player.betThisStreet += paid;
  player.totalContributed += paid;
  player.allIn = player.stack === 0;
  state.pot += paid;
  pushAction(state, player, 'post_blind', paid, player.betThisStreet, potBefore, stackBefore, Math.max(0, amount - paid), undefined, note);
};

const resetStreet = (state: GameState) => {
  state.players.forEach((player) => {
    player.betThisStreet = 0;
  });
  state.currentBet = 0;
  state.minRaiseSize = state.bb;
  state.lastAggressor = -1;
  state.actedSinceLastFullRaise = [];
};

const awardPotByContributions = (state: GameState) => {
  const eligible = state.players.filter((player) => !player.folded && player.totalContributed > 0);
  const levels = [...new Set(state.players.filter((player) => player.totalContributed > 0).map((player) => player.totalContributed))].sort((a, b) => a - b);
  let previousLevel = 0;
  const winnings = new Map<number, number>();

  levels.forEach((level) => {
    const contributors = state.players.filter((player) => player.totalContributed >= level);
    const potSlice = (level - previousLevel) * contributors.length;
    const sliceEligible = eligible.filter((player) => player.totalContributed >= level);
    if (potSlice <= 0 || sliceEligible.length === 0) {
      previousLevel = level;
      return;
    }

    let best = evaluateBestHand([...sliceEligible[0].holeCards, ...state.board]);
    let winners = [sliceEligible[0]];
    sliceEligible.slice(1).forEach((player) => {
      const hand = evaluateBestHand([...player.holeCards, ...state.board]);
      const cmp = compareHands(hand, best);
      if (cmp > 0) {
        best = hand;
        winners = [player];
      } else if (cmp === 0) {
        winners.push(player);
      }
    });

    const orderedWinners = seatOrder(state, nextSeatWithChips(state, state.dealer), winners.map((player) => player.seat));
    const share = Math.floor(potSlice / winners.length);
    let remainder = potSlice - share * winners.length;

    orderedWinners.forEach((seat) => {
      winnings.set(seat, (winnings.get(seat) ?? 0) + share + (remainder > 0 ? 1 : 0));
      if (remainder > 0) remainder -= 1;
    });

    previousLevel = level;
  });

  return winnings;
};

const attachIntegrity = (state: GameState, summary: HandSummary) => {
  const validation = validateHand({
    sb: state.sb,
    bb: state.bb,
    players: state.players,
    summary
  });

  summary.handIntegrity = validation.handIntegrity;
  summary.integrityErrors = validation.integrityErrors;
  state.handIntegrity = validation.handIntegrity;
  state.integrityErrors = validation.integrityErrors;
};

const finalizeHand = (
  state: GameState,
  showdownReached: boolean,
  winnings: Map<number, number>
): GameState => {
  const hero = state.players[0];
  const delta = hero.stack - state.heroStackAtHandStart;
  const busts = state.activeSeatsAtHandStart
    .map((seat) => {
      const starting = state.handStartStacks[seatKey(seat)] ?? 0;
      const player = state.players[seat];
      return starting > 0 && player.stack === 0 ? { seat, name: player.name, stackLost: starting } : null;
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  state.players.forEach((player) => {
    player.busted = player.stack === 0;
    if (player.busted) player.folded = true;
  });

  const winners = [...winnings.entries()].map(([seat, amountWon]) => {
    const player = state.players[seat];
    return {
      seat,
      name: player.name,
      amountWon,
      winningCards: showdownReached && !player.folded ? [...player.holeCards] : undefined
    };
  });

  const recap = rateHand(hero, state.board, state.actions, delta, state.bb, state.players);
  const summary: HandSummary = {
    id: state.handId,
    heroCards: [...hero.holeCards],
    heroPosition: hero.position,
    board: [...state.board],
    actions: [...state.actions],
    startingPot: state.handStartingPot,
    sb: state.sb,
    bb: state.bb,
    buttonSeat: state.dealer,
    smallBlindSeat: state.smallBlindSeat,
    bigBlindSeat: state.bigBlindSeat,
    startingStacks: { ...state.handStartStacks },
    endingStacks: stackMap(state.players),
    activePlayersAtStart: [...state.activeSeatsAtHandStart],
    activeSeatMap: state.players.map((player) => state.activeSeatsAtHandStart.includes(player.seat)),
    tableSizeAtStart: state.activeSeatsAtHandStart.length,
    showdown: showdownReached,
    winners,
    busts,
    handIntegrity: 'valid',
    integrityErrors: [],
    engineVersion: ENGINE_VERSION,
    resultChips: delta,
    resultBb: delta / state.bb,
    ...recap
  };

  attachIntegrity(state, summary);

  state.summary = summary;
  state.stats.winLossBb += delta / state.bb;
  state.stats.biggestWinBb = Math.max(state.stats.biggestWinBb, delta / state.bb);
  state.stats.biggestPuntBb = Math.min(state.stats.biggestPuntBb, delta / state.bb);
  if (showdownReached && !hero.folded) state.stats.wtsdCount += 1;
  state.pendingSeats = [];
  state.actedSinceLastFullRaise = [];
  state.currentSeat = -1;
  state.waitingForHero = false;
  state.pot = 0;
  return state;
};

const showdown = (state: GameState): GameState => {
  const winnings = awardPotByContributions(state);
  winnings.forEach((amount, seat) => {
    state.players[seat].stack += amount;
  });
  return finalizeHand(state, true, winnings);
};

const awardFoldOut = (state: GameState): GameState => {
  const survivor = livePlayers(state)[0];
  const winnings = new Map<number, number>([[survivor.seat, state.pot]]);
  survivor.stack += state.pot;
  return finalizeHand(state, false, winnings);
};

const moveStreet = (state: GameState) => {
  state.previousBoard = [...state.board];
  if (state.street === 'preflop') {
    state.street = 'flop';
    state.board.push(state.deck.pop()!, state.deck.pop()!, state.deck.pop()!);
  } else if (state.street === 'flop') {
    state.street = 'turn';
    state.board.push(state.deck.pop()!);
  } else if (state.street === 'turn') {
    state.street = 'river';
    state.board.push(state.deck.pop()!);
  } else {
    state.street = 'showdown';
  }
  resetStreet(state);
  if (state.street !== 'showdown') {
    state.pendingSeats = livePlayers(state).length > 1 && actingPlayers(state).length <= 1
      ? []
      : buildPendingSeats(state, getFirstToActPostflop(state));
  }
};

const settleState = (state: GameState): GameState => {
  while (!state.summary) {
    if (livePlayers(state).length === 1) return awardFoldOut(state);
    if (state.street === 'showdown') return showdown(state);
    if (state.pendingSeats.length > 0) {
      state.currentSeat = state.pendingSeats[0];
      state.waitingForHero = state.currentSeat === 0;
      return state;
    }
    if (livePlayers(state).length > 1 && actingPlayers(state).length <= 1) {
      moveStreet(state);
      continue;
    }
    moveStreet(state);
  }
  return state;
};

export const beginHand = (input: GameState): GameState => {
  const state = cloneState(input);
  const seatsInGame = activeTableSeats(state);
  state.players.forEach((player) => {
    player.busted = player.stack === 0;
  });

  if (seatsInGame.length < 2) {
    state.activeSeatsAtHandStart = [...seatsInGame];
    state.currentSeat = -1;
    state.pendingSeats = [];
    state.waitingForHero = false;
    return state;
  }

  state.handId += 1;
  state.summary = undefined;
  state.actions = [];
  state.board = [];
  state.previousBoard = [];
  state.deck = shuffleDeck(createDeck());
  state.pot = 0;
  state.street = 'preflop';
  state.currentBet = 0;
  state.minRaiseSize = state.bb;
  state.lastAggressor = -1;
  state.handIntegrity = 'valid';
  state.integrityErrors = [];
  state.heroStackAtHandStart = state.players[0].stack;
  state.dealer = nextSeatWithChips(state, state.dealer);
  state.smallBlindSeat = seatsInGame.length === 2 ? state.dealer : nextSeatWithChips(state, state.dealer);
  state.bigBlindSeat = nextSeatWithChips(state, state.smallBlindSeat);
  state.activeSeatsAtHandStart = activeTableSeats(state);
  state.handStartStacks = stackMap(state.players);
  assignPositions(state, state.dealer, state.activeSeatsAtHandStart);

  state.players.forEach((player) => {
    if (state.activeSeatsAtHandStart.includes(player.seat)) {
      player.holeCards = [state.deck.pop()!, state.deck.pop()!];
      player.folded = false;
      player.allIn = false;
      player.betThisStreet = 0;
      player.totalContributed = 0;
    } else {
      player.holeCards = [];
      player.folded = true;
      player.allIn = true;
      player.betThisStreet = 0;
      player.totalContributed = 0;
      player.position = '';
    }
  });

  postBlind(state, state.smallBlindSeat, state.sb, 'Small blind posted.');
  postBlind(state, state.bigBlindSeat, state.bb, 'Big blind posted.');

  state.currentBet = Math.max(state.players[state.smallBlindSeat].betThisStreet, state.players[state.bigBlindSeat].betThisStreet);
  state.minRaiseSize = state.bb;
  state.lastAggressor = state.bigBlindSeat;
  state.handStartingPot = state.pot;
  state.pendingSeats = buildPendingSeats(state, getFirstToActPreflop(state, state.activeSeatsAtHandStart));
  state.actedSinceLastFullRaise = [];
  state.stats.hands += 1;
  state.stats.vpipOpportunities += 1;
  state.stats.pfrOpportunities += 1;
  return settleState(state);
};

export const legalActions = (state: GameState, seat: number): SeatLegalActions => {
  const player = state.players[seat];
  const actorIsLive = !state.summary && state.currentSeat === seat && !player.folded && !player.allIn && player.stack > 0;
  const toCall = actorIsLive ? Math.max(0, state.currentBet - player.betThisStreet) : 0;
  const maxToAmount = actorIsLive ? player.betThisStreet + player.stack : player.betThisStreet;
  const minBetOrRaiseTo = actorIsLive
    ? state.currentBet === 0
      ? Math.min(maxToAmount, Math.max(state.bb, state.minRaiseSize))
      : Math.min(maxToAmount, state.currentBet + state.minRaiseSize)
    : null;
  const canCheck = actorIsLive && toCall === 0;
  const canCall = actorIsLive && toCall > 0 && player.stack > 0;
  const canBet = actorIsLive && state.currentBet === 0 && player.stack > 0;
  const canRaise = actorIsLive && state.currentBet > 0 && maxToAmount >= (state.currentBet + state.minRaiseSize);
  const raiseAllowed = canRaise && !state.actedSinceLastFullRaise.includes(seat);
  const canAllIn = actorIsLive && player.stack > 0;
  const availableActions: ActionType[] = [];

  if (actorIsLive) {
    availableActions.push('fold');
    if (canCheck) availableActions.push('check');
    if (canCall) availableActions.push('call');
    if (canBet) availableActions.push('bet');
    if (raiseAllowed) availableActions.push('raise');
    if (canAllIn) availableActions.push('all_in');
  }

  return {
    availableActions,
    toCall,
    minRaise: minBetOrRaiseTo ?? 0,
    max: maxToAmount,
    canCheck,
    canFold: actorIsLive,
    canCall,
    canBet,
    canRaise: raiseAllowed,
    canAllIn,
    minBetOrRaiseTo,
    currentBet: state.currentBet,
    minRaiseSize: state.minRaiseSize
  };
};

const assertLegalAction = (state: GameState, seat: number, requestedType: 'fold'|'check'|'call'|'raise'|'all_in', amount: number) => {
  const legal = legalActions(state, seat);
  const normalizedType: ActionType = requestedType === 'raise' && legal.canBet
    ? 'bet'
    : requestedType === 'call' && legal.canCheck
      ? 'check'
      : requestedType;
  if (!legal.availableActions.includes(normalizedType as ActionType)) {
    throw new Error(`Illegal action ${requestedType} by seat ${seat} on ${state.street}.`);
  }
  if ((normalizedType === 'bet' || normalizedType === 'raise') && legal.minBetOrRaiseTo !== null) {
    if (amount < legal.minBetOrRaiseTo || amount > legal.max) {
      throw new Error(`Illegal sizing ${amount} by seat ${seat}. Allowed range: ${legal.minBetOrRaiseTo}-${legal.max}.`);
    }
  }
  return { legal, normalizedType };
};

export const applyAction = (
  input: GameState,
  seat: number,
  requestedType: 'fold'|'check'|'call'|'raise'|'all_in',
  amount = 0
): GameState => {
  const state = cloneState(input);
  const player = state.players[seat];
  const { legal, normalizedType } = assertLegalAction(state, seat, requestedType, amount);
  const potBefore = state.pot;
  const stackBefore = player.stack;
  const amountToCallBefore = legal.toCall;
  const actionSnapshot = makeLegalSnapshot(state, seat, legal);

  state.pendingSeats = state.pendingSeats.filter((pendingSeat) => pendingSeat !== seat);
  if (!state.actedSinceLastFullRaise.includes(seat)) state.actedSinceLastFullRaise.push(seat);

  let committed = 0;
  let toAmount = player.betThisStreet;
  let fullRaise = false;

  if (normalizedType === 'fold') {
    player.folded = true;
  } else if (normalizedType === 'check') {
    committed = 0;
  } else if (normalizedType === 'call') {
    committed = Math.min(legal.toCall, player.stack);
    toAmount = player.betThisStreet + committed;
  } else if (normalizedType === 'bet' || normalizedType === 'raise') {
    toAmount = amount;
    committed = toAmount - player.betThisStreet;
    fullRaise = true;
  } else if (normalizedType === 'all_in') {
    toAmount = player.betThisStreet + player.stack;
    committed = player.stack;
    if (toAmount > state.currentBet) {
      fullRaise = state.currentBet === 0 ? toAmount >= state.bb : (toAmount - state.currentBet) >= state.minRaiseSize;
    }
  }

  if (committed > 0) {
    player.stack -= committed;
    player.betThisStreet += committed;
    player.totalContributed += committed;
    state.pot += committed;
  }

  player.allIn = player.stack === 0;

  if (normalizedType === 'bet') {
    state.currentBet = player.betThisStreet;
    state.minRaiseSize = Math.max(state.bb, player.betThisStreet);
    state.lastAggressor = seat;
    state.pendingSeats = buildPendingSeats(state, nextSeatWithChips(state, seat), seat);
    state.actedSinceLastFullRaise = [seat];
  } else if (normalizedType === 'raise') {
    state.minRaiseSize = player.betThisStreet - state.currentBet;
    state.currentBet = player.betThisStreet;
    state.lastAggressor = seat;
    state.pendingSeats = buildPendingSeats(state, nextSeatWithChips(state, seat), seat);
    state.actedSinceLastFullRaise = [seat];
  } else if (normalizedType === 'all_in' && player.betThisStreet > state.currentBet) {
    const raiseSize = player.betThisStreet - state.currentBet;
    state.currentBet = player.betThisStreet;
    if (state.lastAggressor === -1 || fullRaise) {
      state.lastAggressor = seat;
    }
    if (fullRaise || amountToCallBefore === 0) {
      state.minRaiseSize = fullRaise ? Math.max(state.bb, raiseSize) : state.minRaiseSize;
      state.pendingSeats = buildPendingSeats(state, nextSeatWithChips(state, seat), seat);
      if (fullRaise) state.actedSinceLastFullRaise = [seat];
    } else {
      state.pendingSeats = seatOrder(
        state,
        nextSeatWithChips(state, seat),
        actingPlayers(state)
          .map((candidate) => candidate.seat)
          .filter((candidateSeat) => candidateSeat !== seat && state.players[candidateSeat].betThisStreet < state.currentBet)
      );
    }
  }

  pushAction(state, player, normalizedType, committed, player.betThisStreet, potBefore, stackBefore, amountToCallBefore, actionSnapshot, undefined);

  if (seat === 0 && state.street === 'preflop' && ['call', 'raise', 'bet', 'all_in'].includes(normalizedType)) state.stats.vpipCount += 1;
  if (seat === 0 && state.street === 'preflop' && ['raise', 'bet', 'all_in'].includes(normalizedType)) state.stats.pfrCount += 1;

  return settleState(state);
};

export const takeBotTurn = (state: GameState, strategyMode: StrategyMode = state.strategyMode): BotTurnResult => {
  const seat = state.currentSeat;
  const player = state.players[seat];
  const legal = legalActions(state, seat);
  const decision = decideBotAction({
    archetype: player.profile as Archetype,
    cards: player.holeCards,
    board: state.board,
    previousBoard: state.previousBoard,
    street: state.street,
    toCall: legal.toCall,
    pot: state.pot,
    minRaise: legal.minRaise,
    stack: player.stack,
    canCheck: legal.canCheck,
    position: player.position as Position,
    playersInHand: livePlayers(state).length,
    wasPreflopAggressor: state.actions.some((action) => action.street === 'preflop' && action.seat === seat && (action.type === 'raise' || action.type === 'bet' || action.type === 'all_in')),
    facingThreeBet: state.street === 'preflop' && state.actions.filter((action) => (action.type === 'raise' || action.type === 'bet' || action.type === 'all_in') && action.street === 'preflop').length >= 2,
    hasBetThisStreet: state.actions.some((action) => action.seat === seat && action.street === state.street && (action.type === 'raise' || action.type === 'bet' || action.type === 'all_in')),
    strategyMode
  });
  const nextState = applyAction(state, seat, decision.type, decision.amount);
  nextState.botDebug = decision.debug;
  nextState.strategyMode = strategyMode;
  return { state: nextState, decision };
};

export const runBotsUntilHero = (input: GameState, strategyMode: StrategyMode = input.strategyMode): GameState => {
  let state = cloneState(input);
  state.strategyMode = strategyMode;
  while (!state.waitingForHero && !state.summary) {
    state = takeBotTurn(state, strategyMode).state;
  }
  if (DEV_VALIDATE && state.summary?.handIntegrity === 'invalid') {
    throw new Error(`Invalid hand detected: ${state.summary.integrityErrors.join(' | ')}`);
  }
  return state;
};
