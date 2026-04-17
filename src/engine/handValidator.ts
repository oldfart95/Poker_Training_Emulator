import type { ActionRecord, HandSummary, Player, Street } from './types';

export interface HandValidationResult {
  handIntegrity: 'valid' | 'invalid';
  integrityErrors: string[];
}

export interface HandValidationInput {
  sb: number;
  bb: number;
  players: Player[];
  summary: HandSummary;
}

const STREET_ORDER: Street[] = ['preflop', 'flop', 'turn', 'river', 'showdown'];

const assert = (condition: boolean, message: string, errors: string[]) => {
  if (!condition) errors.push(message);
};

const isAggressive = (action: ActionRecord) => action.type === 'bet' || action.type === 'raise' || action.type === 'all_in';
const isMoneyAction = (action: ActionRecord) => action.amount > 0 || action.type === 'post_blind';

export const validateHand = ({ sb, bb, players, summary }: HandValidationInput): HandValidationResult => {
  const errors: string[] = [];
  const blindActions = summary.actions.filter((action) => action.type === 'post_blind');
  const totalStarting = Object.values(summary.startingStacks).reduce((sum, value) => sum + value, 0);
  const totalEnding = Object.values(summary.endingStacks).reduce((sum, value) => sum + value, 0);
  const totalWinnings = summary.winners.reduce((sum, winner) => sum + winner.amountWon, 0);

  assert(totalStarting === totalEnding, `Stack conservation failed: starting ${totalStarting}, ending ${totalEnding}.`, errors);
  assert(totalWinnings === summary.startingPot + summary.actions.reduce((sum, action) => sum + action.amount, 0) - blindActions.reduce((sum, action) => sum + action.amount, 0), 'Winner payouts do not reconcile with awarded pot.', errors);

  assert(blindActions.length >= Math.min(2, summary.activePlayersAtStart.length), 'Blind posting records are missing.', errors);
  if (blindActions[0]) {
    assert(blindActions[0].seat === summary.smallBlindSeat, 'Small blind actor does not match the hand metadata.', errors);
    assert(blindActions[0].amount === Math.min(sb, summary.startingStacks[String(summary.smallBlindSeat)] ?? 0), 'Small blind amount is invalid.', errors);
  }
  if (blindActions[1]) {
    assert(blindActions[1].seat === summary.bigBlindSeat, 'Big blind actor does not match the hand metadata.', errors);
    assert(blindActions[1].amount === Math.min(bb, summary.startingStacks[String(summary.bigBlindSeat)] ?? 0), 'Big blind amount is invalid.', errors);
  }

  let previousStreetIndex = 0;
  summary.actions.forEach((action, index) => {
    assert(action.actionIndex === index, `Action index ${action.actionIndex} is out of sequence at position ${index}.`, errors);
    assert(action.amount >= 0, `Negative amount on action ${index}.`, errors);
    assert(action.potAfter >= action.potBefore, `Pot moved backward on action ${index}.`, errors);
    assert(STREET_ORDER.includes(action.street), `Unknown street on action ${index}.`, errors);

    const currentStreetIndex = STREET_ORDER.indexOf(action.street);
    assert(currentStreetIndex >= previousStreetIndex, `Street order regressed on action ${index}.`, errors);
    previousStreetIndex = currentStreetIndex;

    if (action.type !== 'post_blind' && action.legalActionsSnapshot) {
      assert(action.legalActionsSnapshot.actorSeat === action.seat, `Action ${index} was taken out of turn by seat ${action.seat}.`, errors);
    }

    if (isMoneyAction(action)) {
      assert(action.stackBefore - action.stackAfter === action.amount, `Stack delta mismatch on action ${index}.`, errors);
      assert(action.potAfter - action.potBefore === action.amount, `Pot delta mismatch on action ${index}.`, errors);
    }

    if (action.type === 'call') {
      assert(action.amountToCallBefore > 0, `Call with zero to-call on action ${index}.`, errors);
    }

    if (action.type === 'check') {
      assert(action.amount === 0, `Check committed chips on action ${index}.`, errors);
      assert(action.amountToCallBefore === 0, `Check taken while facing a bet on action ${index}.`, errors);
    }

    if (action.type === 'bet') {
      assert(action.legalActionsSnapshot?.currentBet === 0, `Bet recorded when a wager already existed on action ${index}.`, errors);
    }

    if (action.type === 'raise') {
      assert((action.legalActionsSnapshot?.currentBet ?? 0) > 0, `Raise recorded with no prior wager on action ${index}.`, errors);
    }

    if (isAggressive(action)) {
      assert(action.toAmount >= action.amount, `Aggressive action ${index} has invalid toAmount.`, errors);
    }
  });

  summary.busts.forEach((bust) => {
    assert((summary.endingStacks[String(bust.seat)] ?? -1) === 0, `Bust recorded for seat ${bust.seat} without a zero ending stack.`, errors);
  });

  players.filter((player) => player.busted).forEach((player) => {
    assert(player.stack === 0, `Seat ${player.seat} marked busted with chips remaining.`, errors);
  });

  if (!summary.showdown) {
    assert(summary.winners.length === 1, 'Non-showdown hand should have exactly one winner.', errors);
  }

  return {
    handIntegrity: errors.length ? 'invalid' : 'valid',
    integrityErrors: errors
  };
};
