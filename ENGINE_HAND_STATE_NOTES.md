# Engine Hand-State Notes

This patch makes the table engine behave like a stricter no-limit hold'em state machine.

## Betting model

- Only one seat is actionable at a time via `currentSeat`.
- The engine tracks per-street money with `betThisStreet` and hand-total money with `totalContributed`.
- `currentBet` is the wager every live player must match on the current street.
- `minRaiseSize` tracks the last full raise increment, not the total bet size.
- `pendingSeats` is the ordered response queue for the current betting round.
- `actedSinceLastFullRaise` blocks illegal re-raises after a short all-in that does not reopen action.

## Action semantics

- `bet` is only used when no prior wager exists on the street.
- `raise` is only used when a prior wager exists and the action is a full raise.
- `call` is only used when `amountToCallBefore > 0`.
- `check` is only used when `amountToCallBefore === 0`.
- `all_in` stays distinct in exports, even when it functions as a call, bet, or raise.
- `post_blind` is recorded explicitly at hand start.

## Hand lifecycle

- Busted seats are `stack === 0` at hand end and are skipped for future cards, blinds, and turn order.
- Heads-up button handling follows hold'em rules: button posts the small blind and acts first preflop.
- When betting is dead because every remaining opponent is all-in, the engine auto-runs the board to showdown.
- Completed hands carry integrity metadata and are validated before normal export assumptions continue.

## Export fields

Each action record now carries:

- `actionIndex`
- `timestamp`
- `street`
- `actorSeat`
- `actorName`
- `action`
- `amount`
- `toAmount`
- `potBefore`
- `potAfter`
- `stackBefore`
- `stackAfter`
- `amountToCallBefore`
- `amountToCallAfter`
- `isAllIn`
- `legalActionsSnapshot`
- `note`

Each hand log now carries:

- `handIntegrity`
- `integrityErrors`
- `engineVersion`
- `tableSizeAtStart`
- `activeSeatMap`
