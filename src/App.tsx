import { useEffect, useMemo, useState } from 'react';
import { decideBotAction } from './ai/decision';
import { Archetype } from './ai/tuning/archetypes';
import { Position } from './ai/tuning/ranges';
import { applyAction, beginHand, createInitialState, legalActions, runBotsUntilHero } from './engine/gameEngine';
import { formatCard } from './engine/deck';
import { GameState } from './engine/gameEngine';
import { Mode } from './engine/types';
import { PaceMode, jitterInRange, paceProfiles, wait } from './presentation/pacing';
import { formatReplaySteps } from './training/replay';
import { StrategyMode } from './strategy/types';
import { helpSections, paceHelp, ratingHelp, strategyModeHelp } from './hints/contextualHelp';
import { generateSpotHint } from './hints/hintGenerator';
import { LIABILITY_DISCLAIMER_DISMISS_KEY, ONBOARDING_DISMISS_KEY, replayGuide, welcomeChecklist } from './hints/onboardingText';

const modeLabel: Record<Mode, string> = {
  'full-ring': 'Table Practice',
  replay: 'Replay Last Hand'
};

const seatClass = ['top', 'top-right', 'bottom-right', 'bottom', 'bottom-left', 'top-left'];
const streetMeta = {
  preflop: { icon: 'P', label: 'Preflop' },
  flop: { icon: 'F', label: 'Flop' },
  turn: { icon: 'T', label: 'Turn' },
  river: { icon: 'R', label: 'River' },
  showdown: { icon: 'S', label: 'Showdown' }
} as const;
const strategyModeLabel: Record<StrategyMode, string> = {
  exploit: 'Adaptive Pressure',
  blueprint: 'Sound Fundamentals'
};
const modeTooltips: Record<Mode, string> = {
  'full-ring': 'Play full hands at the practice table with hints, recap, and session analytics.',
  replay: 'Review the most recent hand street by street with action reads.'
};
const strategyModeCaption: Record<StrategyMode, string> = {
  exploit: 'Leans into player leaks with practical pressure and thinner value where the room gives it up.',
  blueprint: 'Anchors decisions to balanced baseline habits and disciplined range construction.'
};
const archetypeDescriptors: Record<string, string> = {
  Nit: 'Patient, tight, value-heavy',
  TAG: 'Disciplined reg, steady pressure',
  LAG: 'Active opener, wide pressure',
  'Calling Station': 'Sticky caller, under-folds',
  Maniac: 'Chaotic pressure, over-bluffs'
};

const ChipStack = ({ amount }: { amount: number }) => <span className="chip-stack">{amount}</span>;

const PokerCard = ({ value, hidden = false }: { value?: string; hidden?: boolean }) => {
  const rank = value ? value.slice(0, -1) : '';
  const suit = value ? value.slice(-1) : '';
  const suitTone = suit === '\u2665' || suit === '\u2666' ? 'red' : 'black';
  return (
    <span className={`poker-card ${hidden ? 'back' : ''} ${suitTone}`}>
      {hidden ? <span>{'\u2666'}</span> : <><strong>{rank}</strong><em>{suit}</em></>}
    </span>
  );
};

const formatStatPercent = (count: number, opportunities: number) => (
  opportunities ? ((count / opportunities) * 100).toFixed(1) : '0.0'
);

const formatPlayerRead = (profile?: string) => archetypeDescriptors[profile ?? ''] ?? 'Balanced regular';

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
  const [paceMode, setPaceMode] = useState(initialPace);
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

  const replayActions = useMemo(
    () => formatReplaySteps(state.summary, state.players, strategyMode),
    [state.summary, state.players, strategyMode]
  );

  const sessionHighlights = useMemo(() => {
    const stats = state.stats;
    const leaks = Object.entries(stats.mistakes)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1]);

    return {
      hands: stats.hands,
      vpip: formatStatPercent(stats.vpipCount, stats.vpipOpportunities),
      pfr: formatStatPercent(stats.pfrCount, stats.pfrOpportunities),
      wtsd: formatStatPercent(stats.wtsdCount, stats.hands),
      aggression: formatStatPercent(
        stats.pfrCount + stats.threeBetCount + stats.cBetCount,
        stats.pfrOpportunities + stats.threeBetOpportunities + stats.cBetOpportunities
      ),
      biggestWin: stats.biggestWinBb.toFixed(1),
      biggestSetback: stats.biggestPuntBb.toFixed(1),
      leaks
    };
  }, [state.stats]);

  const liveVillains = useMemo(
    () => state.players.filter((player) => !player.isHero).map((player) => ({
      seat: player.seat,
      name: player.name,
      profile: player.profile ?? 'Regular',
      note: formatPlayerRead(player.profile)
    })),
    [state.players]
  );

  useEffect(() => {
    localStorage.setItem('ppp:pace', paceMode);
  }, [paceMode]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (mode !== 'replay') return;
      if (event.key === 'ArrowLeft') setReplayStep((s) => Math.max(0, s - 1));
      if (event.key === 'ArrowRight') setReplayStep((s) => Math.min(replayActions.length - 1, s + 1));
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, replayActions.length]);

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
        wasPreflopAggressor: current.actions.some(
          (a) => a.street === 'preflop' && a.seat === seat && (a.type === 'raise' || a.type === 'all-in')
        ),
        facingThreeBet:
          current.street === 'preflop' &&
          current.actions.filter((a) => (a.type === 'raise' || a.type === 'all-in') && a.street === 'preflop').length >= 2,
        hasBetThisStreet: current.actions.some(
          (a) => a.seat === seat && a.street === current.street && (a.type === 'raise' || a.type === 'all-in' || a.type === 'bet')
        ),
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
      heroAggressor
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
    const next = applyAction(state, 0, type, amount);
    setState(next);
    setSeatBadges((prev) => ({ ...prev, 0: type.toUpperCase() }));
    setReplayStep(0);
    if (!next.summary) {
      await runPresentationQueue(next);
    }
  };

  const dealNextHand = async () => {
    if (processing) return;
    const next = beginHand(state);
    setState(next);
    setSeatBadges({});
    setReplayStep(0);
    setShowHint(false);
    setShowHintMore(false);
    setShowWhy(false);
    await wait(jitterInRange(pace.dealMs));
    await wait(jitterInRange(pace.dealMs));
    if (!next.waitingForHero) {
      await runPresentationQueue(next);
    }
  };

  const currentReplay = replayActions[replayStep];

  return (
    <div className="app">
      <header className="top-bar">
        <div className="brand-block">
          <p className="eyebrow">Pocket Pixel Poker</p>
          <h1>Premium Table Practice</h1>
          <p className="tagline">A serious digital cardroom for hand reading, disciplined decisions, replay study, and opponent-specific adjustment.</p>
        </div>

        <div className="menu mode-menu">
          {(Object.keys(modeLabel) as Mode[]).map((m) => (
            <button key={m} className={mode === m ? 'active' : ''} onClick={() => setMode(m)} title={modeTooltips[m]}>
              {modeLabel[m]}
            </button>
          ))}
        </div>

        <div className="menu strategy-menu">
          {(Object.keys(strategyModeLabel) as StrategyMode[]).map((m) => (
            <button key={m} className={strategyMode === m ? 'active' : ''} onClick={() => setStrategyMode(m)} title={strategyModeHelp[m]}>
              {strategyModeLabel[m]}
            </button>
          ))}
          <button className="neutral" onClick={() => setShowHelp(true)} title="Open the room guide for pacing, hints, replay, and analytics.">
            Room Guide
          </button>
        </div>
      </header>

      <section className="hero-strip">
        <div className="hero-copy">
          <span className="hero-kicker">Live Table Environment</span>
          <strong>{strategyModeLabel[strategyMode]}</strong>
          <p>{strategyModeCaption[strategyMode]}</p>
        </div>
        <div className="hero-copy">
          <span className="hero-kicker">Table Coach</span>
          <strong>Hints stay optional</strong>
          <p>Use quick nudges in the moment, then open the deeper note only when you want study context.</p>
        </div>
        <div className="hero-copy">
          <span className="hero-kicker">Hand Review</span>
          <strong>Replay remains one click away</strong>
          <p>Play naturally, then step through the line with clearer street markers, reads, and pot tracking.</p>
        </div>
      </section>

      {mode === 'full-ring' && (
        <div className="layout">
          <section className="table-shell">
            <div className={`table-surface street-${state.street}`}>
              <div className="table-vignette" />
              <div className="room-light room-light-left" />
              <div className="room-light room-light-right" />
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
                {state.board.length === 0 && <span className="street-hint">Waiting for the next street...</span>}
                {state.board.map((card, index) => (
                  <PokerCard key={`${card.rank}${card.suit}${index}`} value={formatCard(card)} />
                ))}
              </div>

              <div className="seats-ring">
                {state.players.map((player, index) => (
                  <article
                    className={`seat-panel ${seatClass[index]} ${player.isHero ? 'hero' : ''} ${player.folded ? 'folded' : ''} ${(activeSeat === index || (state.currentSeat === index && !state.summary)) ? 'active-turn' : ''}`}
                    key={player.id}
                  >
                    <div className="seat-head">
                      <div>
                        <strong>{player.name}</strong>
                        <div className="seat-subhead">
                          <span className="badge">{player.position}</span>
                          {!player.isHero && player.profile && <span className="profile-pill">{player.profile}</span>}
                        </div>
                      </div>
                      {!player.isHero && player.profile && <span className="seat-read">{formatPlayerRead(player.profile)}</span>}
                    </div>
                    <div className="seat-stack">
                      <ChipStack amount={player.stack} />
                    </div>
                    <div className="seat-cards">
                      {player.isHero
                        ? player.holeCards.map((card, i) => <PokerCard key={`${player.id}-${i}`} value={formatCard(card)} />)
                        : player.holeCards.length > 0 && (
                            <>
                              <PokerCard hidden />
                              <PokerCard hidden />
                            </>
                          )}
                    </div>
                    {thinkingSeat === index && <div className="thinking">Reading the spot...</div>}
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
                  <h4>Welcome to the room</h4>
                  <ul>
                    {welcomeChecklist.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                  <button className="neutral" onClick={dismissOnboarding}>Enter Table</button>
                </div>
              )}

              <div className="action-dock-top">
                <div className="pace-row">
                  <label>Table Pace</label>
                  {(['Fast', 'Normal', 'Study'] as PaceMode[]).map((p) => (
                    <button key={p} className={paceMode === p ? 'active' : ''} onClick={() => setPaceMode(p)} title={paceHelp[p]}>
                      {p}
                    </button>
                  ))}
                </div>

                <div className="hint-row">
                  <button
                    className="neutral"
                    onClick={() => {
                      setShowHint((value) => !value);
                      setShowHintMore(false);
                    }}
                    title="Open a table-side coaching nudge for the current spot."
                  >
                    Coaching Hint
                  </button>
                </div>
              </div>

              <p className="microcopy">
                {state.summary
                  ? 'Hand complete. Review the recap, then deal the next hand when you are ready.'
                  : state.waitingForHero
                    ? `Your action from ${state.players[0].position}. Stay grounded in stack depth, position, and the room profile across from you.`
                    : 'Table action is unfolding. Watch how each archetype enters the pot and where pressure starts to build.'}
              </p>

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

              {showHint && (
                <div className="hint-card">
                  <p><strong>Coach Nudge:</strong> {spotHint.quick}</p>
                  <button className="neutral" onClick={() => setShowHintMore((value) => !value)}>
                    {showHintMore ? 'Hide Study Note' : 'Open Study Note'}
                  </button>
                  {showHintMore && <p>{spotHint.explainMore}</p>}
                </div>
              )}

              <div className="sizing-controls">
                <div className="slider-row">
                  <label>Selected size: {Math.min(betAmount, Math.max(legal.minRaise, legal.max))}</label>
                  <input
                    type="range"
                    min={legal.minRaise}
                    max={Math.max(legal.minRaise, legal.max)}
                    value={Math.min(betAmount, Math.max(legal.minRaise, legal.max))}
                    onChange={(event) => setBetAmount(Number(event.target.value))}
                  />
                </div>
                <div className="presets">
                  {[0.25, 0.33, 0.5, 0.75, 1].map((size) => (
                    <button key={size} onClick={() => setBetAmount(Math.round(state.pot * size))} title="Set your sizing as a percentage of the current pot.">
                      {Math.round(size * 100)}%
                    </button>
                  ))}
                  <button onClick={() => setBetAmount(Math.round(2.5 * state.bb))}>2.5x</button>
                  <button onClick={() => setBetAmount(Math.round(3 * state.bb))}>3x</button>
                </div>
              </div>

              <button className="deal-next" onClick={dealNextHand} disabled={processing}>
                Deal Next Hand
              </button>
              {!state.summary && <p className="microcopy">Need a fresh spot? A new hand keeps the room moving without dropping your session analytics.</p>}
            </div>
          </section>

          <aside className="study-panel">
            <section className="panel-section">
              <div className="panel-heading">
                <div>
                  <p className="panel-kicker">Current Room Policy</p>
                  <h3>{strategyModeLabel[strategyMode]}</h3>
                </div>
                <button className="debug-toggle" onClick={() => setShowHelp(true)}>Room Guide</button>
              </div>
              <p className="tagline">{strategyModeCaption[strategyMode]}</p>
            </section>

            <section className="panel-section">
              <div className="panel-heading">
                <div>
                  <p className="panel-kicker">Hand Recap</p>
                  <h3>Study the last decision path</h3>
                </div>
                {state.summary && (
                  <button className="neutral" onClick={() => setMode('replay')}>
                    Open Replay
                  </button>
                )}
              </div>
              {state.summary ? (
                <div className="summary-block" key={state.summary.id}>
                  <div className="summary-line">{state.summary.heroCards.map(formatCard).join(' ')} | {state.summary.heroPosition}</div>
                  <div className="summary-line">Board: {state.summary.board.map(formatCard).join(' ') || '-'}</div>
                  <div className="summary-chipline">
                    <span>Result</span>
                    <strong>{state.summary.resultChips} chips ({state.summary.resultBb.toFixed(1)} bb)</strong>
                  </div>
                  <div className="action-pins">
                    {state.summary.actions.slice(0, 6).map((action, index) => (
                      <span key={`${state.summary!.id}-${index}`}>{action.street.slice(0, 1).toUpperCase()} | {action.playerName} {action.type}</span>
                    ))}
                  </div>
                  <div className="rating-pill" title={ratingHelp[state.summary.rating]}>Room grade: {state.summary.rating}</div>
                  <p>{state.summary.feedback}</p>
                  <button className="neutral" onClick={() => setShowWhy((value) => !value)}>
                    {showWhy ? 'Hide Breakdown' : 'Why this line?'}
                  </button>
                  {showWhy && <p>{state.summary.why}</p>}
                  <p><em>Discipline note:</em> {state.summary.tighter}</p>
                  <p><em>Pressure note:</em> {state.summary.aggressive}</p>
                </div>
              ) : (
                <p className="coach-placeholder">No hand review yet. Deal a hand, play it naturally, then use the recap here to study the result.</p>
              )}
            </section>

            <section className="panel-section">
              <div className="panel-heading">
                <div>
                  <p className="panel-kicker">Opponent Classes</p>
                  <h3>Recognizable room personalities</h3>
                </div>
              </div>
              <div className="villain-grid">
                {liveVillains.map((villain) => (
                  <article key={villain.seat} className="villain-card">
                    <strong>{villain.name}</strong>
                    <span className="profile-pill">{villain.profile}</span>
                    <p>{villain.note}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="panel-section">
              <div className="panel-heading">
                <div>
                  <p className="panel-kicker">Session Analytics</p>
                  <h3>Results that support study</h3>
                </div>
                <button className="debug-toggle" onClick={() => setShowDebug((value) => !value)}>
                  {showDebug ? 'Hide Debug' : 'Show Debug'}
                </button>
              </div>

              <div className="stats-grid">
                <div className="stat-card">
                  <span>Hands</span>
                  <strong>{sessionHighlights.hands}</strong>
                </div>
                <div className="stat-card">
                  <span>Net</span>
                  <strong>{state.stats.winLossBb.toFixed(1)} bb</strong>
                </div>
                <div className="stat-card">
                  <span>VPIP</span>
                  <strong>{sessionHighlights.vpip}%</strong>
                </div>
                <div className="stat-card">
                  <span>PFR</span>
                  <strong>{sessionHighlights.pfr}%</strong>
                </div>
                <div className="stat-card">
                  <span>WTSD</span>
                  <strong>{sessionHighlights.wtsd}%</strong>
                </div>
                <div className="stat-card">
                  <span>Aggression</span>
                  <strong>{sessionHighlights.aggression}%</strong>
                </div>
              </div>

              <div className="trend-grid">
                <div className="trend-card">
                  <span>Best hand</span>
                  <strong>{sessionHighlights.biggestWin} bb</strong>
                </div>
                <div className="trend-card">
                  <span>Largest setback</span>
                  <strong>{sessionHighlights.biggestSetback} bb</strong>
                </div>
              </div>

              <div className="leak-card">
                <h4>Recurring pressure points</h4>
                {sessionHighlights.leaks.length > 0 ? (
                  <ul className="stats-list">
                    {sessionHighlights.leaks.slice(0, 3).map(([label, count]) => (
                      <li key={label}>{label}: {count}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="microcopy">No repeated leak cluster detected yet. Keep logging hands and the room will surface patterns.</p>
                )}
              </div>

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
                    {Object.entries(state.botDebug.weights).map(([key, value]) => (
                      <span key={key}>{key}:{value.toFixed(2)}</span>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </aside>
        </div>
      )}

      {mode === 'replay' && (
        <section className="replay-shell">
          <div className="replay-header">
            <div>
              <p className="panel-kicker">Replay Last Hand</p>
              <h2>Street-by-street review</h2>
              <p className="tagline">{replayGuide.body}</p>
            </div>
            <div className="replay-meta">
              <span className="profile-pill">{strategyModeLabel[strategyMode]}</span>
              <button className="neutral" onClick={() => setMode('full-ring')}>Back To Table</button>
            </div>
          </div>

          {replayActions.length === 0 ? (
            <p className="coach-placeholder">No hand history yet. Play one full hand at the table, then return here to review the action path.</p>
          ) : (
            <>
              <div className="replay-stage">
                <div className="replay-overview">
                  <span>Step {replayStep + 1} of {replayActions.length}</span>
                  <strong>{currentReplay?.street}</strong>
                  <p>{currentReplay?.who} {currentReplay?.did}</p>
                </div>
                {currentReplay && (
                  <div className="replay-focus">
                    <div className="replay-focus-card">
                      <span className="replay-label">Pot after action</span>
                      <strong>{currentReplay.potAfter}</strong>
                    </div>
                    <div className="replay-focus-card wide">
                      <span className="replay-label">Interpretation</span>
                      <p>{currentReplay.interpretation}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="timeline">
                {replayActions.map((step, index) => (
                  <button
                    key={`${step.street}-${step.who}-${index}`}
                    className={`timeline-step ${index === replayStep ? 'active' : ''}`}
                    onClick={() => setReplayStep(index)}
                  >
                    <span>{step.street}</span>
                    <strong>{step.who}</strong>
                    <em>{step.did}</em>
                  </button>
                ))}
              </div>

              <div className="replay-controls">
                <button onClick={() => setReplayStep((value) => Math.max(0, value - 1))}>Previous</button>
                <button onClick={() => setReplayStep((value) => Math.min(replayActions.length - 1, value + 1))}>Next</button>
              </div>
            </>
          )}
        </section>
      )}

      {showHelp && (
        <div className="modal-backdrop" onClick={() => setShowHelp(false)}>
          <section className="help-modal" onClick={(event) => event.stopPropagation()}>
            <div className="feedback-head">
              <h3>Pocket Pixel Poker Room Guide</h3>
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
            <h3>Training Use Notice</h3>
            <p>
              Pocket Pixel Poker is a practice environment for studying hand contexts, opponent classes, and disciplined decision-making.
              It does not authorize violating any law, platform rule, or integrity policy.
            </p>
            <p>
              <strong>Adaptive Pressure</strong> means adjusting to visible weaknesses like over-folding, over-calling, or unstable sizing patterns.
              It is a study lens for exploitative poker strategy, not cheating.
            </p>
            <p>
              You remain responsible for using the software ethically and lawfully.
            </p>
            <button className="accent" onClick={acceptLiabilityDisclaimer}>I understand</button>
          </section>
        </div>
      )}
    </div>
  );
}
