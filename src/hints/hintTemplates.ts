import { BoardBucket } from '../strategy/buckets/boardBuckets';
import { HandBucket } from '../strategy/buckets/handBuckets';
import { StrategyMode } from '../strategy/types';

export const modeLens: Record<StrategyMode, { quick: string; detail: string }> = {
  blueprint: {
    quick: 'Balanced baseline favors disciplined frequencies here.',
    detail: 'Blueprint mode leans toward stable range protection and avoids over-polarizing marginal nodes.'
  },
  exploit: {
    quick: 'Exploit baseline leans into opponent tendencies.',
    detail: 'Exploit mode shifts toward value-heavy lines versus callers and more pressure versus overfolders.'
  }
};

export const boardHints: Record<BoardBucket, { quick: string; detail: string }> = {
  'a-high-dry': { quick: 'Dry ace-high board often favors the preflop aggressor.', detail: 'Range advantage is usually concentrated with stronger top pairs and overpairs, so pressure can work.' },
  'k-high-dry': { quick: 'King-high dry boards reward clean value and selective bluffs.', detail: 'You can pressure capped ranges, but keep enough checks with medium showdown hands.' },
  'paired-dry': { quick: 'Paired dry boards reduce nutted combinations for both players.', detail: 'Betting small and checking back both have merit because equity realization is compressed.' },
  'low-connected-wet': { quick: 'Low connected boards create many draws and future pressure cards.', detail: 'Wet textures favor caution with thin value and stronger sizing when you have robust equity.' },
  'middling-two-tone': { quick: 'Two-tone middling boards reward hands with backdoors and blockers.', detail: 'Mixing between check and bet keeps your range protected while still denying equity.' },
  monotone: { quick: 'Monotone boards call for blocker-aware, controlled aggression.', detail: 'Without key suit blockers, avoid overbluffing and prefer medium-pot control lines.' },
  'broadway-dynamic': { quick: 'Broadway dynamic boards shift equities quickly across turns.', detail: 'Keep your range flexible: some immediate pressure, some checks to protect turn continues.' },
  'low-disconnected': { quick: 'Disconnected low board reduces immediate high-card collision.', detail: 'You can deny equity with small bets, but medium strength hands still benefit from pot control.' }
};

export const handHints: Record<HandBucket, { quick: string; detail: string }> = {
  'nuts-near-nuts': { quick: 'You are near the top of range: build value now.', detail: 'Prioritize lines that keep worse made hands and strong draws paying into the pot.' },
  'strong-value': { quick: 'Strong value hand: keep extracting while denying equity.', detail: 'Betting is usually preferred unless texture and positions suggest inducing mistakes by checking.' },
  'medium-value': { quick: 'Medium value hand: avoid bloating a pot without clear edge.', detail: 'Choose lines that preserve showdown value and avoid opening yourself to expensive check-raises.' },
  'weak-showdown': { quick: 'You have showdown value; pure bluff lines lose clarity.', detail: 'Check more often and call selectively when blockers and price support bluff-catching.' },
  'strong-draw': { quick: 'Strong draw: semi-bluffing can win now or improve later.', detail: 'Leverage fold equity when you still retain strong equity if called.' },
  'weak-draw': { quick: 'Weak draw needs discipline and clean price.', detail: 'Prefer lower-variance lines unless you have leverage from range advantage or blocker effects.' },
  'bluff-blockers': { quick: 'Blockers make this a better bluff candidate than random air.', detail: 'Use pressure selectively where your blockers remove key continues from villain range.' },
  'bluff-no-blockers': { quick: 'Air without blockers: choose your bluff spots carefully.', detail: 'Without removal effects, overbluffing gets punished. Favor better bluff classes first.' },
  air: { quick: 'Pure air rarely improves: pressure only in high-fold nodes.', detail: 'Select bluff lines mainly when story, range edge, and fold equity align.' }
};
