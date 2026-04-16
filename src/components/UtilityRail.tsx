import type { GameState } from '../engine/gameEngine';
import type { StrategyMode } from '../strategy/types';
import { ExpandableSidePanel, HandRecapPanel } from './TableLayout';

type UtilityPanelKey = 'room' | 'recap' | 'analytics' | null;

export function UtilityRail({
  strategyMode,
  strategyModeLabel,
  strategyModeCaption,
  openPanel,
  toggleUtilityPanel,
  setShowHelp,
  state,
  showWhy,
  setShowWhy,
  setMode,
  liveVillains,
  setShowOpponentDrawer,
  sessionHighlights,
  showDebug,
  setShowDebug,
  ratingHelp
}: {
  strategyMode: StrategyMode;
  strategyModeLabel: Record<StrategyMode, string>;
  strategyModeCaption: Record<StrategyMode, string>;
  openPanel: UtilityPanelKey;
  toggleUtilityPanel: (panel: Exclude<UtilityPanelKey, null>) => void;
  setShowHelp: (value: boolean) => void;
  state: GameState;
  showWhy: boolean;
  setShowWhy: (updater: (value: boolean) => boolean) => void;
  setMode: (mode: 'full-ring' | 'replay') => void;
  liveVillains: Array<{ seat: number; name: string; profile: string; note: string }>;
  setShowOpponentDrawer: (value: boolean) => void;
  sessionHighlights: {
    hands: number;
    vpip: string;
    pfr: string;
    wtsd: string;
    aggression: string;
    biggestWin: string;
    biggestSetback: string;
    leaks: Array<[string, number]>;
  };
  showDebug: boolean;
  setShowDebug: (updater: (value: boolean) => boolean) => void;
  ratingHelp: Record<string, string>;
}) {
  return (
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
        action={(
          <button type="button" className="quiet-button" onClick={() => setShowDebug((value) => !value)}>
            {showDebug ? 'Hide debug' : 'Show debug'}
          </button>
        )}
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
  );
}
