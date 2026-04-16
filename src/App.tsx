import { useEffect, useMemo, useState } from 'react';
import { decideBotAction } from './ai/decision';
import { Archetype } from './ai/tuning/archetypes';
import { Position } from './ai/tuning/ranges';
import { beginHand, applyAction, createInitialState, legalActions, runBotsUntilHero, GameState } from './engine/gameEngine';
import { formatCard } from './engine/deck';
import { Mode, Player } from './engine/types';
import { helpSections, paceHelp, ratingHelp, strategyModeHelp } from './hints/contextualHelp';
import { generateSpotHint } from './hints/hintGenerator';
import { LIABILITY_DISCLAIMER_DISMISS_KEY, ONBOARDING_DISMISS_KEY, replayGuide, welcomeChecklist } from './hints/onboardingText';
import { PaceMode, jitterInRange, paceProfiles, wait } from './presentation/pacing';
import { StrategyMode } from './strategy/types';
import { formatReplaySteps } from './training/replay';
import {
  ChipStack,
  CompactBadge,
  ExpandableSidePanel,
  HandRecapPanel,
  HintPopover,
  PaceControls,
  PlayerSeatCard,
  PokerCard,
  ReplayControls,
  ReplayTimeline,
  StartSessionCard,
  TableStatusStrip
} from './components/TableLayout';

const modeLabel: Record<Mode, string> = { 'full-ring': 'Table Practice', replay: 'Replay Last Hand' };
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
  'full-ring': 'Live table reps with optional hints and review.',
  replay: 'Review the latest hand street by street.'
};
const strategyModeCaption: Record<StrategyMode, string> = {
  exploit: 'Punish leaks when the room gives you one.',
  blueprint: 'Stay balanced and structurally sound first.'
};
const archetypeDescriptors: Record<string, string> = {
  Nit: 'Patient and value-heavy.',
  TAG: 'Disciplined pressure.',
  LAG: 'Wide opener with tempo.',
  'Calling Station': 'Sticky calls and under-folds.',
  Maniac: 'Chaotic pressure and extra bluffs.'
};

type StatusCardKey = 'environment' | 'coach' | 'review' | null;
type UtilityPanelKey = 'room' | 'recap' | 'analytics' | null;

const formatStatPercent = (count: number, opportunities: number) => (
  opportunities ? ((count / opportunities) * 100).toFixed(1) : '0.0'
);
const formatPlayerRead = (profile?: string) => archetypeDescriptors[profile ?? ''] ?? 'Balanced regular.';
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

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
  const [expandedStatus, setExpandedStatus] = useState<StatusCardKey>(null);
  const [openPanel, setOpenPanel] = useState<UtilityPanelKey>(null);
  const [showOpponentDrawer, setShowOpponentDrawer] = useState(false);

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
      if (event.key === 'ArrowLeft') setReplayStep((step) => Math.max(0, step - 1));
      if (event.key === 'ArrowRight') setReplayStep((step) => Math.min(replayActions.length - 1, step + 1));
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
        playersInHand: current.players.filter((seatPlayer) => !seatPlayer.folded).length,
        wasPreflopAggressor: current.actions.some(
          (action) => action.street === 'preflop' && action.seat === seat && (action.type === 'raise' || action.type === 'all-in')
        ),
        facingThreeBet:
          current.street === 'preflop' &&
          current.actions.filter((action) => (action.type === 'raise' || action.type === 'all-in') && action.street === 'preflop').length >= 2,
        hasBetThisStreet: current.actions.some(
          (action) => action.seat === seat && action.street === current.street && (action.type === 'raise' || action.type === 'all-in' || action.type === 'bet')
        ),
        strategyMode
      });

      setThinkingSeat(null);
      current = applyAction(current, seat, decision.type, decision.amount);
      setState(current);
      setSeatBadges((previous) => ({ ...previous, [seat]: decision.type.toUpperCase() }));

      if (decision.amount > 0) {
        setPotPulse(true);
        window.setTimeout(() => setPotPulse(false), jitterInRange(pace.chipMs));
      }

      if (current.street !== previousStreet) {
        setStreetAnimTick((value) => value + 1);
        await wait(jitterInRange(pace.streetMs));
      } else {
        await wait(jitterInRange(pace.postActionMs));
      }
    }

    if (current.summary) {
      await wait(jitterInRange(pace.showdownMs));
      setOpenPanel('recap');
    }

    setThinkingSeat(null);
    setProcessing(false);
  };

  const legal = legalActions(state, 0);
  const canRaise = legal.max >= legal.minRaise && !state.summary;
  const lastAction = state.actions[state.actions.length - 1];
  const hero = state.players[0];
  const selectedBet = clamp(betAmount, legal.minRaise, Math.max(legal.minRaise, legal.max));
  const heroPendingAction = state.waitingForHero && !state.summary;
  const currentReplay = replayActions[replayStep];
  const activeSeatPlayer: Player | undefined = activeSeat === null ? undefined : state.players[activeSeat];

  const tableStateLine = state.summary
    ? `Hand closed at ${state.summary.resultBb.toFixed(1)} bb.`
    : lastAction
      ? `${lastAction.playerName} ${lastAction.type}${lastAction.amount ? ` ${lastAction.amount}` : ''}. Pot ${state.pot}.`
      : `Fresh action. Pot ${state.pot}.`;

  const heroStatusLine = state.summary
    ? 'Replay it or deal the next spot.'
    : heroPendingAction
      ? `${hero.position} to act. ${legal.canCheck ? 'Check is live.' : `Call ${legal.toCall}.`} ${canRaise ? `Min raise ${legal.minRaise}.` : 'Raise closed.'}`
      : 'Watch the table tempo and who is driving the action.';

  const sizingPresets = [
    { label: 'Min', amount: legal.minRaise, disabled: !canRaise },
    { label: '33%', amount: Math.round(Math.max(state.pot, state.bb) * 0.33), disabled: !canRaise },
    { label: '66%', amount: Math.round(Math.max(state.pot, state.bb) * 0.66), disabled: !canRaise },
    { label: 'Pot', amount: Math.round(Math.max(state.pot, state.bb)), disabled: !canRaise },
    { label: 'All-in', amount: legal.max, disabled: !!state.summary || processing }
  ];

  const spotHint = useMemo(() => {
    const liveVillain = state.players.find((player) => !player.isHero && !player.folded);
    const heroAggressor = state.actions.some((action) => action.seat === 0 && (action.type === 'raise' || action.type === 'all-in' || action.type === 'bet'));
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
  }, [state.players, state.actions, state.street, state.board, mode, strategyMode, hero.holeCards, hero.position]);

  const statusCards = [
    {
      key: 'environment',
      icon: '♠',
      title: 'Live Table Environment',
      status: strategyModeLabel[strategyMode],
      detail: strategyModeCaption[strategyMode]
    },
    {
      key: 'coach',
      icon: '◎',
      title: 'Table Coach',
      status: showHint ? 'Hint ready' : 'Hints optional',
      detail: 'Keep coaching tucked away until you want a quick nudge or a deeper study note.'
    },
    {
      key: 'review',
      icon: '↺',
      title: 'Hand Review',
      status: state.summary ? 'Replay available' : 'Waiting on next hand',
      detail: 'Recap stays collapsed by default, but the latest line is always one tap away.'
    }
  ] as const;

  const dismissOnboarding = () => {
    const nextValue = !showOnboarding;
    setShowOnboarding(nextValue);
    localStorage.setItem(ONBOARDING_DISMISS_KEY, nextValue ? '0' : '1');
  };

  const acceptLiabilityDisclaimer = () => {
    setShowLiabilityDisclaimer(false);
    localStorage.setItem(LIABILITY_DISCLAIMER_DISMISS_KEY, '1');
  };

  const toggleUtilityPanel = (panel: UtilityPanelKey) => {
    setOpenPanel((currentPanel) => currentPanel === panel ? null : panel);
  };

  const heroAction = async (type: 'fold' | 'check' | 'call' | 'raise' | 'all-in', amount = 0) => {
    if (processing) return;

    const next = applyAction(state, 0, type, amount);
    setState(next);
    setSeatBadges((previous) => ({ ...previous, 0: type.toUpperCase() }));
    setReplayStep(0);
    setShowHint(false);
    setShowHintMore(false);

    if (!next.summary) {
      await runPresentationQueue(next);
    } else {
      setOpenPanel('recap');
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
    setActiveSeat(null);

    await wait(jitterInRange(pace.dealMs));
    await wait(jitterInRange(pace.dealMs));

    if (!next.waitingForHero) {
      await runPresentationQueue(next);
    }
  };

  return (
    <div className="app premium-shell">
      <header className="top-bar">
        <div className="brand-block">
          <p className="eyebrow">Pocket Pixel Poker</p>
          <h1>Premium Table Practice</h1>
          <p className="tagline">Sit down, play the hand, and open the study surfaces only when you need them.</p>
        </div>

        <ReplayControls mode={mode} onModeChange={setMode} modeLabel={modeLabel} />

        <div className="menu strategy-menu">
          {(Object.keys(strategyModeLabel) as StrategyMode[]).map((entryMode) => (
            <button
              key={entryMode}
              type="button"
              className={strategyMode === entryMode ? 'active' : ''}
              onClick={() => setStrategyMode(entryMode)}
              title={strategyModeHelp[entryMode]}
            >
              {strategyModeLabel[entryMode]}
            </button>
          ))}
          <button type="button" className="neutral" onClick={() => setShowHelp(true)} title="Open the room guide.">
            Room Guide
          </button>
        </div>
      </header>

      <TableStatusStrip
        cards={statusCards as unknown as Array<{ key: string; icon: string; title: string; status: string; detail: string }>}
        expanded={expandedStatus}
        onToggle={(key) => setExpandedStatus((current) => current === key ? null : (key as StatusCardKey))}
      />

      {mode === 'full-ring' && (
        <div className="practice-layout">
          <section className="stage-column">
            <div className="table-topline">
              <div className="topline-chips">
                <CompactBadge tone="accent" title={strategyModeCaption[strategyMode]}>
                  {strategyModeLabel[strategyMode]}
                </CompactBadge>
                <CompactBadge>{streetMeta[state.street].label}</CompactBadge>
                <CompactBadge tone={state.summary ? 'default' : heroPendingAction ? 'hero' : 'default'}>
                  {heroPendingAction ? 'Hero decision' : state.summary ? 'Hand complete' : 'Table in motion'}
                </CompactBadge>
              </div>
              <div className="topline-actions">
                <HintPopover
                  visible={showHint}
                  quick={spotHint.quick}
                  detail={spotHint.explainMore}
                  expanded={showHintMore}
                  onToggle={() => {
                    setShowHint((value) => !value);
                    setShowHintMore(false);
                  }}
                  onToggleExpanded={() => setShowHintMore((value) => !value)}
                />
                {state.summary && (
                  <button type="button" className="neutral" onClick={() => setMode('replay')}>
                    Replay Last Hand
                  </button>
                )}
              </div>
            </div>

            <section className="table-shell stage-focus">
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
                {lastAction && !state.summary && (
                  <div key={`${state.handId}-${state.actions.length}`} className={`chip-trail seat-${lastAction.seat}`} />
                )}
                <div className={`street-banner ${state.street}`}>
                  <span>{streetMeta[state.street].icon}</span> {streetMeta[state.street].label}
                </div>
                <div className="table-state-ribbon">
                  <strong>{heroPendingAction ? 'Decision live' : state.summary ? 'Recap ready' : 'Action in motion'}</strong>
                  <span>{tableStateLine}</span>
                </div>
                <div
                  className={`board-lane ${streetAnimTick ? 'street-transition' : ''}`}
                  key={`${state.handId}-${state.board.length}-${streetAnimTick}`}
                >
                  {state.board.length === 0 && <span className="street-hint">Waiting for the board...</span>}
                  {state.board.map((card, index) => (
                    <PokerCard key={`${card.rank}${card.suit}${index}`} value={formatCard(card)} />
                  ))}
                </div>
                {activeSeatPlayer && (
                  <aside className="seat-popover">
                    <p className="panel-kicker">Seat Detail</p>
                    <h3>{activeSeatPlayer.name}</h3>
                    <div className="seat-popover-row">
                      <CompactBadge tone={activeSeatPlayer.isHero ? 'hero' : 'default'}>{activeSeatPlayer.position}</CompactBadge>
                      {!activeSeatPlayer.isHero && activeSeatPlayer.profile && (
                        <CompactBadge>{activeSeatPlayer.profile}</CompactBadge>
                      )}
                    </div>
                    <p className="compact-copy">
                      {activeSeatPlayer.isHero ? 'Your current seat and stack.' : formatPlayerRead(activeSeatPlayer.profile)}
                    </p>
                  </aside>
                )}
                <div className="seats-ring">
                  {state.players.map((player, index) => (
                    <PlayerSeatCard
                      key={player.id}
                      player={player}
                      seatClass={seatClass[index]}
                      activeTurn={(state.currentSeat === index && !state.summary) || thinkingSeat === index}
                      thinking={thinkingSeat === index}
                      actionBadge={seatBadges[index] && !state.summary ? seatBadges[index] : undefined}
                      selected={activeSeat === index}
                      onSelect={() => setActiveSeat((current) => current === index ? null : index)}
                      cardLabels={player.holeCards.map((card) => formatCard(card))}
                      archetypeRead={formatPlayerRead(player.profile)}
                    />
                  ))}
                </div>
              </div>
            </section>

            <section className="control-grid">
              <StartSessionCard
                expanded={showOnboarding}
                bullets={welcomeChecklist}
                onToggle={dismissOnboarding}
                onDeal={dealNextHand}
                disabled={processing}
              />

              <section className={`decision-card ${heroPendingAction ? 'live' : ''}`}>
                <div className="card-heading">
                  <div>
                    <p className="panel-kicker">Current Decision</p>
                    <h3>{heroPendingAction ? `${hero.position} in the box` : state.summary ? 'Hand archived' : 'Observe the room'}</h3>
                  </div>
                  <PaceControls paceMode={paceMode} onChange={setPaceMode} paceHelp={paceHelp} />
                </div>

                <p className="compact-copy">{heroStatusLine}</p>

                <div className="intel-row">
                  <div className="intel-pill">
                    <span>Pot</span>
                    <strong>{state.pot}</strong>
                  </div>
                  <div className="intel-pill">
                    <span>{legal.canCheck ? 'Check' : 'To call'}</span>
                    <strong>{legal.canCheck ? 'Free' : legal.toCall}</strong>
                  </div>
                  <div className="intel-pill">
                    <span>Min raise</span>
                    <strong>{canRaise ? legal.minRaise : '-'}</strong>
                  </div>
                  <div className="intel-pill">
                    <span>Hero stack</span>
                    <strong>{hero.stack}</strong>
                  </div>
                </div>

                <div className="primary-actions">
                  <button type="button" className="danger" disabled={!!state.summary || processing} onClick={() => heroAction('fold')}>
                    Fold
                  </button>
                  <button
                    type="button"
                    className={`neutral ${legal.canCheck ? 'soft' : ''}`}
                    disabled={!!state.summary || processing}
                    onClick={() => heroAction(legal.canCheck ? 'check' : 'call')}
                  >
                    {legal.canCheck ? 'Check' : `Call ${legal.toCall}`}
                  </button>
                  <button type="button" className="accent" disabled={!canRaise || processing} onClick={() => heroAction('raise', selectedBet)}>
                    Raise To {selectedBet}
                  </button>
                  <button type="button" className="gold" disabled={!!state.summary || processing} onClick={() => heroAction('all-in')}>
                    All-in
                  </button>
                </div>

                <div className="sizing-controls compact">
                  <div className="slider-row">
                    <label htmlFor="raise-size-slider">
                      <span>Raise size</span>
                      <strong>{selectedBet}</strong>
                    </label>
                    <input
                      id="raise-size-slider"
                      type="range"
                      min={legal.minRaise}
                      max={Math.max(legal.minRaise, legal.max)}
                      value={selectedBet}
                      onChange={(event) => setBetAmount(Number(event.target.value))}
                      disabled={!canRaise || processing}
                    />
                  </div>
                  <div className="presets">
                    {sizingPresets.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        disabled={preset.disabled}
                        onClick={() => setBetAmount(clamp(preset.amount, legal.minRaise, Math.max(legal.minRaise, legal.max)))}
                        title="Set a quick sizing."
                      >
                        <span>{preset.label}</span>
                        <strong>{preset.label === 'All-in' ? legal.max : clamp(preset.amount, legal.minRaise, Math.max(legal.minRaise, legal.max))}</strong>
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            </section>
          </section>

          <aside className="utility-rail">
            <section className="utility-hero-card">
              <div>
                <p className="panel-kicker">Active Room</p>
                <h3>{strategyModeLabel[strategyMode]}</h3>
              </div>
              <p className="compact-copy">{strategyModeCaption[strategyMode]}</p>
            </section>

            <ExpandableSidePanel
              kicker="Current Room Policy"
              title={strategyModeLabel[strategyMode]}
              summary={strategyMode === 'exploit' ? 'Exploit adjustments live' : 'Baseline discipline live'}
              open={openPanel === 'room'}
              onToggle={() => toggleUtilityPanel('room')}
              action={<button type="button" className="quiet-button" onClick={() => setShowHelp(true)}>Guide</button>}
            >
              <p className="compact-copy">{strategyModeCaption[strategyMode]}</p>
              <div className="room-policy-points">
                <span>{strategyMode === 'exploit' ? 'Lean into leaks.' : 'Start balanced.'}</span>
                <span>{strategyMode === 'exploit' ? 'Value thinner versus callers.' : 'Protect your ranges.'}</span>
                <span>{strategyMode === 'exploit' ? 'Pressure over-folders.' : 'Add pressure selectively.'}</span>
              </div>
            </ExpandableSidePanel>

            <ExpandableSidePanel
              kicker="Hand Recap"
              title={state.summary ? 'Latest hand ready' : 'Waiting on next hand'}
              summary={state.summary ? `${state.summary.resultBb.toFixed(1)} bb` : 'No recap yet'}
              open={openPanel === 'recap'}
              onToggle={() => toggleUtilityPanel('recap')}
            >
              <HandRecapPanel
                summary={state.summary}
                ratingTitle={state.summary ? ratingHelp[state.summary.rating] : undefined}
                showWhy={showWhy}
                onToggleWhy={() => setShowWhy((value) => !value)}
                onOpenReplay={() => setMode('replay')}
              />
            </ExpandableSidePanel>

            <section className="drawer-trigger-card">
              <div>
                <p className="panel-kicker">Opponent Classes</p>
                <h3>{liveVillains.length} seats tagged</h3>
              </div>
              <p className="compact-copy">Open the player drawer for archetypes without crowding the felt.</p>
              <button type="button" className="neutral" onClick={() => setShowOpponentDrawer(true)}>
                Open Opponent Drawer
              </button>
            </section>

            <ExpandableSidePanel
              kicker="Session Analytics"
              title="Study trends"
              summary={`${sessionHighlights.hands} hands | ${state.stats.winLossBb.toFixed(1)} bb`}
              open={openPanel === 'analytics'}
              onToggle={() => toggleUtilityPanel('analytics')}
              action={
                <button type="button" className="quiet-button" onClick={() => setShowDebug((value) => !value)}>
                  {showDebug ? 'Hide debug' : 'Show debug'}
                </button>
              }
            >
              <div className="stats-grid compact-grid">
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
                  <span>Agg</span>
                  <strong>{sessionHighlights.aggression}%</strong>
                </div>
              </div>

              <div className="trend-grid">
                <div className="trend-card">
                  <span>Best</span>
                  <strong>{sessionHighlights.biggestWin} bb</strong>
                </div>
                <div className="trend-card">
                  <span>Worst</span>
                  <strong>{sessionHighlights.biggestSetback} bb</strong>
                </div>
              </div>

              <div className="leak-card">
                <h4>Pressure points</h4>
                {sessionHighlights.leaks.length > 0 ? (
                  <ul className="stats-list compact-list">
                    {sessionHighlights.leaks.slice(0, 3).map(([label, count]) => (
                      <li key={label}>{label}: {count}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="compact-copy">No recurring cluster yet.</p>
                )}
              </div>

              {showDebug && state.botDebug && (
                <div className="debug-panel">
                  <h4>Bot Debug</h4>
                  <div>Archetype: {state.botDebug.archetype}</div>
                  <div>Mode: {state.botDebug.mode}</div>
                  <div>Bucket: {state.botDebug.bucket}</div>
                  <div>Texture: {state.botDebug.texture}</div>
                  {state.botDebug.adjustments.length > 0 && <div>Adjustments: {state.botDebug.adjustments.join(' | ')}</div>}
                  <div>Reason: {state.botDebug.reason}</div>
                </div>
              )}
            </ExpandableSidePanel>
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
              <CompactBadge>{strategyModeLabel[strategyMode]}</CompactBadge>
              <button type="button" className="neutral" onClick={() => setMode('full-ring')} title={modeTooltips['full-ring']}>
                Back To Table
              </button>
            </div>
          </div>

          {replayActions.length === 0 ? (
            <p className="compact-copy">No hand history yet. Play one hand at the table, then return here.</p>
          ) : (
            <>
              <div className="replay-stage">
                <div className="replay-stage-top">
                  <div className="replay-overview">
                    <span>Step {replayStep + 1} of {replayActions.length}</span>
                    <strong>{currentReplay?.street}</strong>
                    <p>{currentReplay?.who} {currentReplay?.did}</p>
                  </div>
                  <div className="replay-progress">
                    {replayActions.map((step, index) => (
                      <button
                        key={`${step.street}-marker-${index}`}
                        type="button"
                        className={`replay-progress-stop ${index === replayStep ? 'active' : ''}`}
                        onClick={() => setReplayStep(index)}
                        title={`${step.street} - ${step.who} ${step.did}`}
                      >
                        <span>{index + 1}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {currentReplay && (
                  <div className="replay-focus">
                    <div className="replay-focus-card">
                      <span className="replay-label">Pot after action</span>
                      <strong>{currentReplay.potAfter}</strong>
                    </div>
                    <div className="replay-focus-card">
                      <span className="replay-label">Action taken</span>
                      <strong>{currentReplay.did}</strong>
                    </div>
                    <div className="replay-focus-card wide">
                      <span className="replay-label">Key takeaway</span>
                      <p>{currentReplay.interpretation}</p>
                    </div>
                  </div>
                )}
              </div>

              <ReplayTimeline steps={replayActions} replayStep={replayStep} onStepChange={setReplayStep} />

              <div className="replay-controls">
                <button type="button" onClick={() => setReplayStep((value) => Math.max(0, value - 1))}>Previous</button>
                <button type="button" onClick={() => setReplayStep((value) => Math.min(replayActions.length - 1, value + 1))}>Next</button>
              </div>
            </>
          )}
        </section>
      )}

      {showOpponentDrawer && (
        <div className="modal-backdrop" onClick={() => setShowOpponentDrawer(false)}>
          <section className="help-modal opponent-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="feedback-head">
              <div>
                <p className="panel-kicker">Opponent Classes</p>
                <h3>Quick player reads</h3>
              </div>
              <button type="button" className="neutral" onClick={() => setShowOpponentDrawer(false)}>Close</button>
            </div>
            <div className="villain-grid">
              {liveVillains.map((villain) => (
                <article key={villain.seat} className="villain-card">
                  <strong>{villain.name}</strong>
                  <CompactBadge>{villain.profile}</CompactBadge>
                  <p>{villain.note}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}

      {showHelp && (
        <div className="modal-backdrop" onClick={() => setShowHelp(false)}>
          <section className="help-modal" onClick={(event) => event.stopPropagation()}>
            <div className="feedback-head">
              <div>
                <p className="panel-kicker">Room Guide</p>
                <h3>Pocket Pixel Poker</h3>
              </div>
              <button type="button" className="neutral" onClick={() => setShowHelp(false)}>Close</button>
            </div>
            {helpSections.map((section) => (
              <div key={section.title} className="help-section">
                <h4>{section.title}</h4>
                <ul className="compact-list">
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
            <p className="panel-kicker">Training Use Notice</p>
            <h3>Practice surface only</h3>
            <p>Use this room to study hand reading, pacing, and exploitative versus balanced choices.</p>
            <p>Adaptive Pressure means reacting to visible leaks, not violating any law, platform rule, or integrity policy.</p>
            <button type="button" className="accent" onClick={acceptLiabilityDisclaimer}>I understand</button>
          </section>
        </div>
      )}
    </div>
  );
}
