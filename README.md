# Pocket Pixel Poker

Pocket Pixel Poker is a single-player Texas Hold'em practice room built around full-hand play, opponent archetypes, optional coaching hints, replay, and session analytics.

The product direction is intentionally not a bundle of poker drills. The core experience is sitting down at a polished digital table, playing against recognizable player classes, and studying the result afterward.

## Product focus
- Main table practice with full hand flow from deal to showdown
- Two strategy policies:
  - `Adaptive Pressure` for exploitative adjustment
  - `Sound Fundamentals` for balanced baseline play
- Optional hint-assisted learning during the hand
- Replay Last Hand for street-by-street review
- Session analytics centered on hands played, net bb, VPIP, PFR, WTSD, aggression, and recurring leak patterns

## Stack
- React + TypeScript + Vite
- Local in-memory poker engine state
- Vitest coverage for core engine, strategy, and presentation helpers

## Quick start
```bash
npm install
npm run dev
```

## Scripts
```bash
npm run dev
npm run build
npm run preview
npm run test
```

## Current feature set
- 6-max NLHE practice table with hero plus five archetype bots
- Full dealing, blinds, action legality, street progression, and showdown flow
- Opponent classes surfaced as room personalities: Nit, TAG, LAG, Calling Station, Maniac
- Contextual coaching hints with short and expanded study views
- Hand recap with rating, feedback, and line explanation
- Replay timeline for the last completed hand
- Session analytics for table-study trends

## Architecture notes
- `src/engine/`: pure poker logic for deck, evaluator, game flow, and action legality
- `src/ai/`: bot decision engine and tuning inputs
- `src/strategy/`: baseline and exploitative policy layer
- `src/hints/`: onboarding, contextual help, and spot hints
- `src/training/`: recap coaching, replay formatting, and internal training utilities retained for reusable logic
- `src/App.tsx`: app composition for table practice, replay, and study surfaces

## Known limitations
- Side pots are not fully implemented yet; standard main-pot flow is the supported path
- Bot strategy is heuristic and practical, not solver-perfect
- Some extended metrics are scaffolded more deeply than they are surfaced in the UI
- Visual motion remains lightweight CSS so the app stays GitHub Pages friendly

## Future polish ideas
1. Exportable hand histories from the replay view
2. Richer opponent-read notes based on observed table behavior
3. More detailed street-by-street recap breakdowns
4. Better side-pot accounting and validation
5. Expanded analytics trends once more hand volume accumulates

## GitHub Pages deployment
- The repo includes `.github/workflows/deploy.yml` to build and publish `dist/` to GitHub Pages on pushes to `main`.
- Set **Pages -> Source** to **GitHub Actions** in repository settings.
- Vite uses a relative base path so the app works locally and on project Pages URLs.
