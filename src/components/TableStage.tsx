import { formatCard } from '../engine/deck';
import type { GameState } from '../engine/gameEngine';
import type { Player } from '../engine/types';
import type { PaceMode } from '../presentation/pacing';
import type { StrategyMode } from '../strategy/types';
import {
  ChipStack,
  CompactBadge,
  HintPopover,
  PaceControls,
  PlayerSeatCard,
  PokerCard,
  StartSessionCard
} from './TableLayout';

type StreetKey = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

export function TableStage({
  strategyMode,
  strategyModeLabel,
  strategyModeCaption,
  streetMeta,
  state,
  potPulse,
  lastAction,
  heroPendingAction,
  tableStateLine,
  activeSeatPlayer,
  activeSeat,
  thinkingSeat,
  seatBadges,
  seatClass,
  formatPlayerRead,
  setActiveSeat,
  streetAnimTick,
  showHint,
  showHintMore,
  spotHint,
  setShowHint,
  setShowHintMore,
  setMode,
  showOnboarding,
  welcomeChecklist,
  dismissOnboarding,
  dealNextHand,
  processing,
  hero,
  legal,
  canRaise,
  selectedBet,
  sizingPresets,
  heroStatusLine,
  heroAction,
  paceMode,
  setPaceMode,
  setBetAmount,
  paceHelp
}: {
  strategyMode: StrategyMode;
  strategyModeLabel: Record<StrategyMode, string>;
  strategyModeCaption: Record<StrategyMode, string>;
  streetMeta: Record<StreetKey, { icon: string; label: string }>;
  state: GameState;
  potPulse: boolean;
  lastAction?: { seat: number };
  heroPendingAction: boolean;
  tableStateLine: string;
  activeSeatPlayer?: Player;
  activeSeat: number | null;
  thinkingSeat: number | null;
  seatBadges: Record<number, string>;
  seatClass: string[];
  formatPlayerRead: (profile?: string) => string;
  setActiveSeat: (updater: (current: number | null) => number | null) => void;
  streetAnimTick: number;
  showHint: boolean;
  showHintMore: boolean;
  spotHint: { quick: string; explainMore: string };
  setShowHint: () => void;
  setShowHintMore: (updater: (value: boolean) => boolean) => void;
  setMode: (mode: 'full-ring' | 'replay') => void;
  showOnboarding: boolean;
  welcomeChecklist: string[];
  dismissOnboarding: () => void;
  dealNextHand: () => void;
  processing: boolean;
  hero: Player;
  legal: { canCheck: boolean; toCall: number; minRaise: number; max: number };
  canRaise: boolean;
  selectedBet: number;
  sizingPresets: Array<{ label: string; amount: number; disabled: boolean }>;
  heroStatusLine: string;
  heroAction: (type: 'fold' | 'check' | 'call' | 'raise' | 'all-in', amount?: number) => void;
  paceMode: PaceMode;
  setPaceMode: (paceMode: PaceMode) => void;
  setBetAmount: (amount: number) => void;
  paceHelp: Record<PaceMode, string>;
}) {
  return (
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
            onToggle={setShowHint}
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
                  onClick={() => setBetAmount(Math.max(legal.minRaise, Math.min(preset.amount, Math.max(legal.minRaise, legal.max))))}
                  title="Set a quick sizing."
                >
                  <span>{preset.label}</span>
                  <strong>{preset.label === 'All-in' ? legal.max : Math.max(legal.minRaise, Math.min(preset.amount, Math.max(legal.minRaise, legal.max)))}</strong>
                </button>
              ))}
            </div>
          </div>
        </section>
      </section>
    </section>
  );
}
