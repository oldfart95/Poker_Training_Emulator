# Pocket Pixel Poker

Pocket Pixel Poker is a **single-player Texas Hold'em training simulator** with cozy pixel-inspired UI and arcade flavor.

## Goals
- Train transferable poker fundamentals (position, preflop discipline, c-bets, pot odds, leaks).
- Keep gameplay loop quick and fun while preserving rule correctness.
- No real-money gambling, no multiplayer backend, no monetization.

## Stack
- React + TypeScript + Vite
- Local in-memory engine state
- Optional localStorage-ready stats utilities
- Vitest unit tests for core logic

## Quick start
```bash
npm install
npm run dev
```
Open the local URL from Vite (typically `http://localhost:5173`).

## Scripts
```bash
npm run dev
npm run build
npm run preview
npm run test
```

## MVP features included
- 6-max NLHE loop (hero + 5 archetype bots)
- Blinds, dealing, street progression, showdown, legal action controls
- Hand evaluator for standard hand classes
- Bot archetypes: Nit, TAG, LAG, Calling Station, Maniac
- Training recap after each hand: rating + practical coaching
- Drill modes:
  - Full Ring Loop
  - Preflop Trainer
  - C-Bet Trainer
  - Blind Defense Trainer
  - Replay Last Hand
- Session stats panel (VPIP, PFR, WTSD, win/loss bb baseline)

## Architecture notes
- `src/engine/`: pure poker logic (deck, evaluator, game flow, action legality)
- `src/ai/`: decision engine + central tuning configs (`tuning/`) for ranges, c-bets, barrel/bluff frequencies, and thresholds
- `src/training/`: recap coaching and drill spot generation
- `src/utils/`: persistence helpers
- `src/App.tsx`: UI composition and trainer mode switching

## Known limitations
- Side pots are not fully implemented yet (main pot flow works; all-in edge-cases with multiple stack depths are a TODO).
- Bot postflop strategy is heuristic and intentionally not solver-perfect (now bucket/texture aware).
- Current stats are partial MVP set (3-bet/fold-to-3-bet/c-bet counters scaffolded but not fully wired).
- Animations are lightweight CSS-style only (no advanced sprite system yet).

## TODO (next improvements)
1. Full side-pot accounting and split-pot validation.
2. Accurate per-opportunity stat tracking for full HUD metrics.
3. Better postflop board-class + blocker-aware bot heuristics.
4. Seed-based reproducible scenario generation.
5. Export hand history and replay timeline UI polish.
6. Optional CRT/pixel shader and dark/sepia theme toggles.
7. Hotkeys for fold/check/raise presets.
8. Side-pot solver-level edge-case validation harness.
