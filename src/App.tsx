import { useEffect, useMemo, useState } from 'react';
import { decideBotAction } from './ai/decision';
import { Archetype } from './ai/tuning/archetypes';
import { Position } from './ai/tuning/ranges';
import { applyAction, beginHand, createInitialState, GameState, legalActions, runBotsUntilHero } from './engine/gameEngine';
import { Mode, Player } from './engine/types';
import { helpSections, paceHelp, ratingHelp, strategyModeHelp } from './hints/contextualHelp';
import { generateSpotHint } from './hints/hintGenerator';
import { LIABILITY_DISCLAIMER_DISMISS_KEY, ONBOARDING_DISMISS_KEY, replayGuide, welcomeChecklist } from './hints/onboardingText';
import { jitterInRange, PaceMode, paceProfiles, wait } from './presentation/pacing';
import { StrategyMode } from './strategy/types';
import { formatReplaySteps } from './training/replay';
import { CompactBadge, ReplayControls, TableStatusStrip } from './components/TableLayout';
import { ReplayView } from './components/ReplayView';
import { TableStage } from './components/TableStage';
import { UtilityRail } from './components/UtilityRail';

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
      icon: '\u2660',
      title: 'Live Table Environment',
      status: strategyModeLabel[strategyMode],
      detail: strategyModeCaption[strategyMode]
    },
    {
      key: 'coach',
      icon: '\u25ce',
      title: 'Table Coach',
      status: showHint ? 'Hint ready' : 'Hints optional',
      detail: 'Keep coaching tucked away until you want a quick nudge or a deeper study note.'
    },
    {
      key: 'review',
      icon: '\u21ba',
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

  const toggleUtilityPanel = (panel: Exclude<UtilityPanelKey, null>) => {
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
          <TableStage
            strategyMode={strategyMode}
            strategyModeLabel={strategyModeLabel}
            strategyModeCaption={strategyModeCaption}
            streetMeta={streetMeta}
            state={state}
            potPulse={potPulse}
            lastAction={lastAction}
            heroPendingAction={heroPendingAction}
            tableStateLine={tableStateLine}
            activeSeatPlayer={activeSeatPlayer}
            activeSeat={activeSeat}
            thinkingSeat={thinkingSeat}
            seatBadges={seatBadges}
            seatClass={seatClass}
            formatPlayerRead={formatPlayerRead}
            setActiveSeat={setActiveSeat}
            streetAnimTick={streetAnimTick}
            showHint={showHint}
            showHintMore={showHintMore}
            spotHint={spotHint}
            setShowHint={setShowHint}
            setShowHintMore={setShowHintMore}
            setMode={setMode}
            showOnboarding={showOnboarding}
            welcomeChecklist={welcomeChecklist}
            dismissOnboarding={dismissOnboarding}
            dealNextHand={dealNextHand}
            processing={processing}
            hero={hero}
            legal={legal}
            canRaise={canRaise}
            selectedBet={selectedBet}
            sizingPresets={sizingPresets}
            heroStatusLine={heroStatusLine}
            heroAction={heroAction}
            paceMode={paceMode}
            setPaceMode={setPaceMode}
            setBetAmount={setBetAmount}
            paceHelp={paceHelp}
          />

          <UtilityRail
            strategyMode={strategyMode}
            strategyModeLabel={strategyModeLabel}
            strategyModeCaption={strategyModeCaption}
            openPanel={openPanel}
            toggleUtilityPanel={toggleUtilityPanel}
            setShowHelp={setShowHelp}
            state={state}
            showWhy={showWhy}
            setShowWhy={setShowWhy}
            setMode={setMode}
            liveVillains={liveVillains}
            setShowOpponentDrawer={setShowOpponentDrawer}
            sessionHighlights={sessionHighlights}
            showDebug={showDebug}
            setShowDebug={setShowDebug}
            ratingHelp={ratingHelp}
          />
        </div>
      )}

      {mode === 'replay' && (
        <ReplayView
          replayGuideBody={replayGuide.body}
          strategyMode={strategyMode}
          strategyModeLabel={strategyModeLabel}
          setMode={setMode}
          modeTooltips={modeTooltips}
          replayActions={replayActions}
          replayStep={replayStep}
          setReplayStep={setReplayStep}
          currentReplay={currentReplay}
        />
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
