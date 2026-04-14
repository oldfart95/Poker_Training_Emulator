import { useEffect, useMemo, useState } from 'react';
import { decideBotAction } from './ai/decision';
import { Archetype } from './ai/tuning/archetypes';
import { Position } from './ai/tuning/ranges';
import { applyAction, beginHand, createInitialState, legalActions, runBotsUntilHero } from './engine/gameEngine';
import { formatCard } from './engine/deck';
import { GameState } from './engine/gameEngine';
import { Mode } from './engine/types';
import { PaceMode, jitterInRange, paceProfiles, wait } from './presentation/pacing';
import { nextDrillSpot } from './training/drills';
import { formatReplaySteps } from './training/replay';
import { BlindDefenseContext, CBetContext, evaluateBlindDefense, evaluateCBet, evaluatePreflop, PreflopContext, TrainingAction, TrainingFeedback } from './training/scoring';
import { StrategyMode } from './strategy/types';
import { helpSections, paceHelp, ratingHelp, strategyModeHelp } from './hints/contextualHelp';
import { generateSpotHint } from './hints/hintGenerator';
import { LIABILITY_DISCLAIMER_DISMISS_KEY, ONBOARDING_DISMISS_KEY, trainerInstructions, welcomeChecklist } from './hints/onboardingText';

const modeLabel: Record<Mode, string> = {
  'full-ring': 'Full Ring Loop',
  'preflop-trainer': 'Preflop Trainer',
  'cbet-trainer': 'C-Bet Trainer',
  'blind-defense': 'Blind Defense Trainer',
  replay: 'Replay Last Hand'
};

const seatClass = ['top', 'top-right', 'bottom-right', 'bottom', 'bottom-left', 'top-left'];
const streetMeta = {
  preflop: { icon: '◈', label: 'Preflop' },
  flop: { icon: '◉', label: 'Flop' },
  turn: { icon: '◎', label: 'Turn' },
  river: { icon: '✦', label: 'River' },
  showdown: { icon: '◆', label: 'Showdown' }
} as const;
const strategyModeLabel: Record<StrategyMode, string> = { exploit: 'Exploit Mode', blueprint: 'Blueprint Mode' };
const modeTooltips: Record<Mode, string> = {
  'full-ring': 'Play full hands from deal to showdown and review recap.',
  'preflop-trainer': 'Rapid preflop reps: opening, calling, folding, and 3-betting.',
  'cbet-trainer': 'Practice flop continuation betting decisions.',
  'blind-defense': 'Practice blind responses versus late-position opens.',
  replay: 'Replay your most recent hand step by step.'
};

const ChipStack = ({ amount }: { amount: number }) => <span className="chip-stack">{amount}</span>;

const PokerCard = ({ value, hidden = false }: { value?: string; hidden?: boolean }) => {
  const rank = value ? value.slice(0, -1) : '';
  const suit = value ? value.slice(-1) : '';
  const suitTone = suit === '♥' || suit === '♦' ? 'red' : 'black';
  return (
    <span className={`poker-card ${hidden ? 'back' : ''} ${suitTone}`}>
      {hidden ? <span>♦</span> : <><strong>{rank}</strong><em>{suit}</em></>}
    </span>
  );
};

const verdictTone = (verdict?: TrainingFeedback['verdict']) => {
  if (!verdict) return 'neutral';
  if (verdict === 'Best') return 'best';
  if (verdict === 'Good') return 'good';
  if (verdict === 'Okay') return 'okay';
  if (verdict === 'Mistake') return 'mistake';
  return 'punt';
};

export default function App() {
  const storedPace = localStorage.getItem('ppp:pace');
  const initialPace: PaceMode = storedPace === 'Fast' || storedPace === 'Study' ? storedPace : 'Normal';
  const [mode, setMode] = useState<Mode>('full-ring');
  const [strategyMode, setStrategyMode] = useState<StrategyMode>('exploit');
  const [state, setState] = useState(() => runBotsUntilHero(beginHand(createInitialState()), 'exploit'));
  const [processing, setProcessing] = useState(false);
  const [replayStep, setReplayStep] = useState(0);
  const [betAmount, setBetAmount] = useState(250);
  const [showWhy, setShowWhy] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [seedMode, setSeedMode] = useState(false);
  const [drillSeed, setDrillSeed] = useState(20260413);
  const [drillIndex, setDrillIndex] = useState(0);
  const [drill, setDrill] = useState(() => nextDrillSpot('preflop-trainer'));
  const [feedback, setFeedback] = useState<TrainingFeedback | null>(null);
  const [trainingScore, setTrainingScore] = useState(0);
  const [paceMode, setPaceMode] = useState<PaceMode>(initialPace);
  const [activeSeat, setActiveSeat] = useState<number | null>(null);
  const [thinkingSeat, setThinkingSeat] = useState<number | null>(null);
  const [seatBadges, setSeatBadges] = useState<Record<number, string>>({});
  const [potPulse, setPotPulse] = useState(false);
  const [streetAnimTick, setStreetAnimTick] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showHintMore, setShowHintMore] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => localStorage.getItem(ONBOARDING_DISMISS_KEY) !== '1');
  const [showLiabilityDisclaimer, setShowLiabilityDisclaimer] = useState(() => localStorage.getItem(LIABILITY_DISCLAIMER_DISMISS_KEY) !== '1');

  const pace = paceProfiles[paceMode];

  const replayActions = useMemo(() => formatReplaySteps(state.summary, state.players, strategyMode), [state.summary, state.players, strategyMode]);
  const buildNextDrill = (targetMode: Mode, indexOffset = 0) =>
    nextDrillSpot(targetMode, seedMode ? { seed: drillSeed, index: drillIndex + indexOffset } : undefined);

  useEffect(() => {
    localStorage.setItem('ppp:pace', paceMode);
  }, [paceMode]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (mode === 'replay') {
        if (event.key === 'ArrowLeft') setReplayStep((s) => Math.max(0, s - 1));
        if (event.key === 'ArrowRight') setReplayStep((s) => Math.min(replayActions.length - 1, s + 1));
      }
      if (mode !== 'full-ring' && mode !== 'replay' && event.key.toLowerCase() === 'n') {
        const next = buildNextDrill(mode, 1);
        setDrill(next);
        if (seedMode) setDrillIndex((v) => v + 1);
        setFeedback(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, replayActions.length, seedMode, drillSeed, drillIndex]);

  const runPresentationQueue = async (start: GameState) => {
    let current = structuredClone(start);
    setProcessing(true);

    while (!current.waitingForHero && !current.summary) {
      const seat = current.currentSeat;
      const player = current.players[seat];
      const legal = legalActions(current, seat);
      const previousStreet = current.street;

      setActiveSeat(seat);
      setThinkingSeat(seat);
      await wait(jitterInRange(pace.thinkMs));

      const decision = decideBotAction({
        archetype: player.profile as Archetype,
        cards: player.holeCards,
        board: current.board,
        previousBoard: current.previousBoard,
        street: current.street,
        toCall: legal.toCall,
        pot: current.pot,
        minRaise: legal.minRaise,
        stack: player.stack,
        canCheck: legal.canCheck,
        position: player.position as Position,
        playersInHand: current.players.filter((p) => !p.folded).length,
        wasPreflopAggressor: current.actions.some((a) => a.street === 'preflop' && a.seat === seat && (a.type === 'raise' || a.type === 'all-in')),
        facingThreeBet: current.street === 'preflop' && current.actions.filter((a) => (a.type === 'raise' || a.type === 'all-in') && a.street === 'preflop').length >= 2,
        hasBetThisStreet: current.actions.some((a) => a.seat === seat && a.street === current.street && (a.type === 'raise' || a.type === 'all-in' || a.type === 'bet')),
        strategyMode
      });

      setThinkingSeat(null);
      current = applyAction(current, seat, decision.type, decision.amount);
      setState(current);
      setSeatBadges((prev) => ({ ...prev, [seat]: decision.type.toUpperCase() }));
      if (decision.amount > 0) {
        setPotPulse(true);
        window.setTimeout(() => setPotPulse(false), jitterInRange(pace.chipMs));
      }

      if (current.street !== previousStreet) {
        setStreetAnimTick((v) => v + 1);
        await wait(jitterInRange(pace.streetMs));
      } else {
        await wait(jitterInRange(pace.postActionMs));
      }
    }

    if (current.summary) {
      await wait(jitterInRange(pace.showdownMs));
    }

    setActiveSeat(current.summary ? null : current.currentSeat);
    setThinkingSeat(null);
    setProcessing(false);
  };

  const legal = legalActions(state, 0);
  const canRaise = legal.max >= legal.minRaise && !state.summary;
  const lastAction = state.actions[state.actions.length - 1];

  const spotHint = useMemo(() => {
    const hero = state.players[0];
    const liveVillain = state.players.find((p) => !p.isHero && !p.folded);
    const heroAggressor = state.actions.some((a) => a.seat === 0 && (a.type === 'raise' || a.type === 'all-in' || a.type === 'bet'));
    return generateSpotHint({
      mode,
      strategyMode,
      street: state.street,
      heroCards: hero.holeCards,
      board: state.board,
      heroPosition: hero.position,
      opponentArchetype: liveVillain?.profile,
      heroAggressor,
      trainerType: mode !== 'full-ring' && mode !== 'replay' ? mode : undefined
    });
  }, [state.players, state.actions, state.street, state.board, mode, strategyMode]);

  const dismissOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem(ONBOARDING_DISMISS_KEY, '1');
  };

  const acceptLiabilityDisclaimer = () => {
    setShowLiabilityDisclaimer(false);
    localStorage.setItem(LIABILITY_DISCLAIMER_DISMISS_KEY, '1');
  };

  const heroAction = async (type: 'fold' | 'check' | 'call' | 'raise' | 'all-in', amount = 0) => {
    if (processing) return;
    let s = applyAction(state, 0, type, amount);
    setState(s);
    setSeatBadges((prev) => ({ ...prev, 0: type.toUpperCase() }));
    setReplayStep(0);
    if (!s.summary) {
      await runPresentationQueue(s);
    }
  };

  const dealNextHand = async () => {
    if (processing) return;
    const next = beginHand(state);
    setState(next);
    setSeatBadges({});
    setReplayStep(0);
    await wait(jitterInRange(pace.dealMs));
    await wait(jitterInRange(pace.dealMs));
    if (!next.waitingForHero) {
      await runPresentationQueue(next);
    }
  };

  const handleMode = (m: Mode) => {
    setMode(m);
    if (m === 'full-ring') return;
    if (m === 'replay') return;
    setDrillIndex(0);
    setDrill(buildNextDrill(m, 0));
    setFeedback(null);
  };

  const scoreDrill = (action: TrainingAction) => {
    if (!drill) return;
    let result: TrainingFeedback;

    if (drill.category === 'preflop-trainer') {
      result = evaluatePreflop(drill.heroCards, action, { ...(drill.context as PreflopContext), strategyMode, opponentProfile: 'Calling Station' });
    } else if (drill.category === 'cbet-trainer') {
      result = evaluateCBet(drill.heroCards, drill.board ?? [], action, { ...(drill.context as CBetContext), strategyMode, opponentProfile: 'Nit' });
    } else {
      result = evaluateBlindDefense(drill.heroCards, action, { ...(drill.context as BlindDefenseContext), strategyMode, opponentProfile: 'Maniac' });
    }

    setFeedback(result);
    setTrainingScore((prev) => prev + result.scoreDelta);
  };

  return (
    <div className="app">
      <header className="top-bar">
        <div>
          <h1>Pocket Pixel Poker</h1>
          <p className="tagline">Cozy pixel cardroom • serious hand study</p>
        </div>
        <div className="menu">
          {(Object.keys(modeLabel) as Mode[]).map((m) => (
            <button key={m} className={mode === m ? 'active' : ''} onClick={() => handleMode(m)} title={modeTooltips[m]}>
              {modeLabel[m]}
            </button>
          ))}
        </div>
        <div className="menu">
          {(Object.keys(strategyModeLabel) as StrategyMode[]).map((m) => (
            <button key={m} className={strategyMode === m ? 'active' : ''} onClick={() => setStrategyMode(m)} title={strategyModeHelp[m]}>
              {strategyModeLabel[m]}
            </button>
          ))}
          <button className="neutral" onClick={() => setShowHelp(true)} title="Open a short guide for modes, pacing, recap ratings, and hints.">
            ? Help
          </button>
        </div>
      </header>

      {mode === 'full-ring' && (
        <div className="layout">
          <section className="table-shell">
            <div className={`table-surface street-${state.street}`}>
              <div className="table-vignette" />
              <div className={`pot-plaque ${potPulse ? 'pot-pulse' : ''}`}>
                <span className="label">Main Pot</span>
                <div key={`${state.handId}-${state.pot}`} className="pot-pop">
                  <ChipStack amount={state.pot} />
                </div>
              </div>
              {lastAction && !state.summary && <div key={`${state.handId}-${state.actions.length}`} className={`chip-trail seat-${lastAction.seat}`} />}
              <div className={`street-banner ${state.street}`}>
                <span>{streetMeta[state.street].icon}</span> {streetMeta[state.street].label}
              </div>
              <div className={`board-lane ${streetAnimTick ? 'street-transition' : ''}`} key={`${state.handId}-${state.board.length}-${streetAnimTick}`}>
                {state.board.length === 0 && <span className="street-hint">Waiting for flop...</span>}
                {state.board.map((c, i) => (
                  <PokerCard key={`${c.rank}${c.suit}${i}`} value={formatCard(c)} />
                ))}
              </div>

              <div className="seats-ring">
                {state.players.map((p, index) => (
                  <article
                    className={`seat-panel ${seatClass[index]} ${p.isHero ? 'hero' : ''} ${p.folded ? 'folded' : ''} ${(activeSeat === index || (state.currentSeat === index && !state.summary)) ? 'active-turn' : ''}`}
                    key={p.id}
                  >
                    <div className="seat-head">
                      <strong>{p.name}</strong>
                      <span className="badge">{p.position}</span>
                    </div>
                    <div className="seat-stack">
                      <ChipStack amount={p.stack} />
                    </div>
                    <div className="seat-cards">
                      {p.isHero
                        ? p.holeCards.map((card, i) => <PokerCard key={`${p.id}-${i}`} value={formatCard(card)} />)
                        : p.holeCards.length > 0 && (
                            <>
                              <PokerCard hidden />
                              <PokerCard hidden />
                            </>
                          )}
                    </div>
                    {thinkingSeat === index && <div className="thinking">Thinking…</div>}
                    {seatBadges[index] && !state.summary && (
                      <div key={`${state.handId}-${index}-${seatBadges[index]}`} className="action-badge">{seatBadges[index]}</div>
                    )}
                  </article>
                ))}
              </div>
            </div>

            <div className="action-dock">
              {showOnboarding && (
                <div className="coach-card">
                  <h4>Welcome to Pocket Pixel Poker</h4>
                  <ul>
                    {welcomeChecklist.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                  <button className="neutral" onClick={dismissOnboarding}>Got it</button>
                </div>
              )}
              <div className="pace-row">
                <label>Pace</label>
                {(['Fast', 'Normal', 'Study'] as PaceMode[]).map((p) => (
                  <button key={p} className={paceMode === p ? 'active' : ''} onClick={() => setPaceMode(p)} title={paceHelp[p]}>
                    {p}
                  </button>
                ))}
              </div>
              <p className="microcopy">{state.summary ? 'Hand complete. Review recap, then deal the next hand when ready.' : (state.waitingForHero ? `Your turn (${state.players[0].position}). Choose your action.` : 'Table action is in progress. Watch ranges unfold.')}</p>
              <div className="primary-actions">
                <button className="danger" disabled={!!state.summary || processing} onClick={() => heroAction('fold')}>
                  Fold
                </button>
                <button
                  className={`neutral ${legal.canCheck ? 'soft' : ''}`}
                  disabled={!!state.summary || processing}
                  onClick={() => heroAction(legal.canCheck ? 'check' : 'call')}
                >
                  {legal.canCheck ? 'Check' : `Call ${legal.toCall}`}
                </button>
                <button className="accent" disabled={!canRaise || processing} onClick={() => heroAction('raise', betAmount)}>
                  Bet / Raise
                </button>
                <button className="gold" disabled={!!state.summary || processing} onClick={() => heroAction('all-in')}>
                  All-in
                </button>
              </div>
              <div className="hint-row">
                <button className="neutral" onClick={() => { setShowHint((v) => !v); setShowHintMore(false); }} title="Quick coaching nudge for this exact spot.">
                  Hint
                </button>
              </div>
              {showHint && (
                <div className="hint-card">
                  <p><strong>Quick Hint:</strong> {spotHint.quick}</p>
                  <button className="neutral" onClick={() => setShowHintMore((v) => !v)}>{showHintMore ? 'Hide Details' : 'Explain More'}</button>
                  {showHintMore && <p>{spotHint.explainMore}</p>}
                </div>
              )}

              <div className="sizing-controls">
                <div className="slider-row">
                  <label>Size: {Math.min(betAmount, Math.max(legal.minRaise, legal.max))}</label>
                  <input
                    type="range"
                    min={legal.minRaise}
                    max={Math.max(legal.minRaise, legal.max)}
                    value={Math.min(betAmount, Math.max(legal.minRaise, legal.max))}
                    onChange={(e) => setBetAmount(Number(e.target.value))}
                  />
                </div>
                <div className="presets">
                  {[0.25, 0.33, 0.5, 0.75, 1].map((s) => (
                    <button key={s} onClick={() => setBetAmount(Math.round(state.pot * s))} title="Set your bet as a percentage of the current pot.">
                      {Math.round(s * 100)}%
                    </button>
                  ))}
                  <button onClick={() => setBetAmount(Math.round(2.5 * state.bb))}>2.5x</button>
                  <button onClick={() => setBetAmount(Math.round(3 * state.bb))}>3x</button>
                </div>
              </div>
              <button className="deal-next" onClick={dealNextHand} disabled={processing}>
                Deal Next Hand
              </button>
              {!state.summary && <p className="microcopy">Need a fresh spot? Deal Next Hand resets the table instantly.</p>}
            </div>
          </section>

          <aside className="study-panel">
            <h3>Study Recap</h3>
            <p className="tagline">Active strategy: <strong>{strategyModeLabel[strategyMode]}</strong></p>
            {state.summary ? (
              <div className="summary-block" key={state.summary.id}>
                <div className="summary-line">{state.summary.heroCards.map(formatCard).join(' ')} • {state.summary.heroPosition}</div>
                <div className="summary-line">Board: {state.summary.board.map(formatCard).join(' ') || '—'}</div>
                <div className="summary-chipline">
                  <span>Result</span>
                  <strong>{state.summary.resultChips} chips ({state.summary.resultBb.toFixed(1)} bb)</strong>
                </div>
                <div className="action-pins">
                  {state.summary.actions.slice(0, 5).map((action, index) => (
                    <span key={`${state.summary?.id}-${index}`}>{action.street.slice(0, 1).toUpperCase()} · {action.playerName} {action.type}</span>
                  ))}
                </div>
                <div className="rating-pill" title={ratingHelp[state.summary.rating]}>Rating: {state.summary.rating}</div>
                <p>{state.summary.feedback}</p>
                <button className="neutral" onClick={() => setShowWhy((v) => !v)}>
                  {showWhy ? 'Hide Why' : 'Why this line?'}
                </button>
                {showWhy && <p>{state.summary.why}</p>}
                <p><em>Tighter:</em> {state.summary.tighter}</p>
                <p><em>Aggressive:</em> {state.summary.aggressive}</p>
              </div>
            ) : (
              <p className="coach-placeholder">No recap yet. Click <strong>Deal Next Hand</strong>, play the spot, then review rating + coach notes here.</p>
            )}
            <button className="debug-toggle" onClick={() => setShowHelp(true)}>Need help?</button>

            <div className="debug-wrap">
              <button className="debug-toggle" onClick={() => setShowDebug((v) => !v)}>
                {showDebug ? 'Hide Debug Tools' : 'Show Debug Tools'}
              </button>
              {showDebug && state.botDebug && (
                <div className="debug-panel">
                  <h4>Bot Debug</h4>
                  <div>Archetype: {state.botDebug.archetype}</div>
                  <div>Mode: {state.botDebug.mode}</div>
                  <div>Hand bucket: {state.botDebug.bucket}</div>
                  <div>Board bucket: {state.botDebug.texture}</div>
                  {state.botDebug.adjustments.length > 0 && <div>Adjustments: {state.botDebug.adjustments.join(' | ')}</div>}
                  <div>Reason: {state.botDebug.reason}</div>
                  <div className="debug-weights">
                    {Object.entries(state.botDebug.weights).map(([k, v]) => (
                      <span key={k}>{k}:{v.toFixed(2)} </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <h4>Session Stats</h4>
            <ul className="stats-list">
              <li>VPIP: {state.stats.vpipOpportunities ? ((state.stats.vpipCount / state.stats.vpipOpportunities) * 100).toFixed(1) : 0}%</li>
              <li>PFR: {state.stats.pfrOpportunities ? ((state.stats.pfrCount / state.stats.pfrOpportunities) * 100).toFixed(1) : 0}%</li>
              <li>Win/Loss: {state.stats.winLossBb.toFixed(1)} bb</li>
              <li>WTSD: {state.stats.hands ? ((state.stats.wtsdCount / state.stats.hands) * 100).toFixed(1) : 0}%</li>
            </ul>
          </aside>
        </div>
      )}

      {mode !== 'full-ring' && mode !== 'replay' && drill && (
        <section className="drill">
          <h2>{modeLabel[mode]} · {strategyModeLabel[strategyMode]} · Score {trainingScore}</h2>
          <div className="coach-placeholder">
            <strong>{trainerInstructions[mode].title}:</strong> {trainerInstructions[mode].body}
          </div>
          <div className="drill-actions">
            <button className={seedMode ? 'active' : ''} onClick={() => setSeedMode((v) => !v)}>
              {seedMode ? 'Deterministic ON' : 'Deterministic OFF'}
            </button>
            <label>Seed</label>
            <input type="number" value={drillSeed} onChange={(e) => setDrillSeed(Number(e.target.value) || 0)} />
            {drill.seedTag && <span>Spot {drill.seedTag}</span>}
          </div>
          <p>{drill.prompt}</p>
          <div>
            Hero: {drill.heroCards.map(formatCard).join(' ')} {drill.board ? `| Board: ${drill.board.map(formatCard).join(' ')}` : ''}
          </div>
          <div className="drill-actions">
            {drill.choices.map((c) => (
              <button key={c} onClick={() => scoreDrill(c)}>{c.toUpperCase()}</button>
            ))}
            <button className="neutral" onClick={() => { setShowHint((v) => !v); setShowHintMore(false); }} title="Quick coaching nudge for this training spot.">
              Hint
            </button>
            <button className="neutral" onClick={() => {
              const next = buildNextDrill(mode, 1);
              setDrill(next);
              if (seedMode) setDrillIndex((v) => v + 1);
              setFeedback(null);
            }}>
              Next Spot
            </button>
          </div>
          <p>Coach note: {drill.note}</p>
          {showHint && (
            <div className="hint-card">
              <p><strong>Quick Hint:</strong> {spotHint.quick}</p>
              <button className="neutral" onClick={() => setShowHintMore((v) => !v)}>{showHintMore ? 'Hide Details' : 'Explain More'}</button>
              {showHintMore && <p>{spotHint.explainMore}</p>}
            </div>
          )}
          {feedback && (
            <div className={`feedback-card ${verdictTone(feedback.verdict)}`}>
              <div className="feedback-head">
                <span className="verdict-badge">{strategyModeLabel[strategyMode]}</span>
                <span className="verdict-badge">{feedback.verdict}</span>
                <strong>{feedback.scoreDelta >= 0 ? '+' : ''}{feedback.scoreDelta}</strong>
              </div>
              {feedback.boardTexture && <p><strong>Board texture:</strong> {feedback.boardTexture}</p>}
              {feedback.rangeAdvantage && <p><strong>Range edge:</strong> {feedback.rangeAdvantage}</p>}
              <p><strong>Best action:</strong> {feedback.bestAction}</p>
              <p><strong>Also okay:</strong> {feedback.acceptableAlternatives.join(', ') || '—'}</p>
              <p><strong>EV band:</strong> {feedback.evBand} · <strong>Confidence:</strong> {feedback.confidence}</p>
              <p><strong>Why:</strong> {feedback.shortExplanation}</p>
              <p><strong>Coach note:</strong> {feedback.coachNote}</p>
            </div>
          )}
        </section>
      )}

      {mode === 'replay' && (
        <section className="drill">
          <h2>Replay Last Hand</h2>
          <div className="coach-placeholder">
            <strong>{trainerInstructions.replay.title}:</strong> {trainerInstructions.replay.body}
          </div>
          <p>Mode: {strategyModeLabel[strategyMode]}</p>
          {replayActions.length === 0 && <p className="microcopy">No hand history yet. Play one hand in Full Ring Loop, then return here to study the action path.</p>}
          <p>Step {replayStep + 1} / {Math.max(replayActions.length, 1)}</p>
          {replayActions[replayStep] && (
            <div className="feedback-card okay">
              <p><strong>{replayActions[replayStep].street}</strong> · {replayActions[replayStep].who} {replayActions[replayStep].did}</p>
              <p><strong>Pot after action:</strong> {replayActions[replayStep].potAfter}</p>
              <p><strong>Interpretation:</strong> {replayActions[replayStep].interpretation}</p>
            </div>
          )}
          <button onClick={() => setReplayStep((s) => Math.max(0, s - 1))}>Prev</button>
          <button onClick={() => setReplayStep((s) => Math.min(replayActions.length - 1, s + 1))}>Next</button>
        </section>
      )}

      {showHelp && (
        <div className="modal-backdrop" onClick={() => setShowHelp(false)}>
          <section className="help-modal" onClick={(e) => e.stopPropagation()}>
            <div className="feedback-head">
              <h3>Pocket Pixel Poker Help</h3>
              <button className="neutral" onClick={() => setShowHelp(false)}>Close</button>
            </div>
            {helpSections.map((section) => (
              <div key={section.title} className="help-section">
                <h4>{section.title}</h4>
                <ul>
                  {section.bullets.map((point) => <li key={point}>{point}</li>)}
                </ul>
              </div>
            ))}
          </section>
        </div>
      )}

      {showLiabilityDisclaimer && (
        <div className="modal-backdrop">
          <section className="help-modal disclaimer-modal">
            <h3>!!!DISCLAIMER!!!</h3>
            <p>
              Pocket Pixel Poker is a training simulator for educational use only. It does not provide legal advice or authorization
              to violate any rules, laws, platform terms, or game integrity policies.
            </p>
            <p>
              <strong>Exploit Mode</strong> means adapting to weak player tendencies (for example over-folding, over-calling, or
              predictable sizing) to improve strategy study. It is about <strong>pushing weak players strategically</strong>, not
              cheating.
            </p>
            <p>
              You are solely responsible for how you use this software. By continuing, you agree to use it ethically and lawfully.
            </p>
            <button className="accent" onClick={acceptLiabilityDisclaimer}>I understand</button>
          </section>
        </div>
      )}
    </div>
  );
}
