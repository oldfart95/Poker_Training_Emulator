import type { ReactNode } from 'react';
import type { HandSummary, Mode, Player } from '../engine/types';
import type { PaceMode } from '../presentation/pacing';
import type { ReplayStep } from '../training/replay';

type Tone = 'default' | 'accent' | 'danger' | 'hero';

const toneClass: Record<Tone, string> = {
  default: '',
  accent: 'accent',
  danger: 'danger',
  hero: 'hero'
};

export const CompactBadge = ({
  children,
  tone = 'default',
  title
}: {
  children: ReactNode;
  tone?: Tone;
  title?: string;
}) => (
  <span className={`compact-badge ${toneClass[tone]}`.trim()} title={title}>
    {children}
  </span>
);

export const ChipStack = ({ amount }: { amount: number }) => <span className="chip-stack">{amount}</span>;

export const PokerCard = ({ value, hidden = false }: { value?: string; hidden?: boolean }) => {
  const rank = value ? value.slice(0, -1) : '';
  const suit = value ? value.slice(-1) : '';
  const suitTone = suit === '\u2665' || suit === '\u2666' ? 'red' : 'black';

  return (
    <span className={`poker-card ${hidden ? 'back' : ''} ${suitTone}`}>
      {hidden ? <span>{'\u2666'}</span> : <><strong>{rank}</strong><em>{suit}</em></>}
    </span>
  );
};

export const TableStatusStrip = ({
  cards,
  expanded,
  onToggle
}: {
  cards: Array<{ key: string; icon: string; title: string; status: string; detail: string }>;
  expanded: string | null;
  onToggle: (key: string) => void;
}) => (
  <section className="status-strip" aria-label="Table status">
    {cards.map((card) => {
      const isOpen = expanded === card.key;
      return (
        <article key={card.key} className={`status-card ${isOpen ? 'open' : ''}`}>
          <button
            type="button"
            className="status-card-toggle"
            aria-expanded={isOpen}
            onClick={() => onToggle(card.key)}
          >
            <span className="status-icon" aria-hidden="true">{card.icon}</span>
            <span className="status-copy">
              <span className="status-title">{card.title}</span>
              <strong>{card.status}</strong>
            </span>
            <span className="status-affordance">{isOpen ? 'Hide' : 'More'}</span>
          </button>
          {isOpen && <p className="status-detail">{card.detail}</p>}
        </article>
      );
    })}
  </section>
);

export const PlayerSeatCard = ({
  player,
  seatClass,
  activeTurn,
  thinking,
  actionBadge,
  selected,
  onSelect,
  cardLabels,
  archetypeRead
}: {
  player: Player;
  seatClass: string;
  activeTurn: boolean;
  thinking: boolean;
  actionBadge?: string;
  selected: boolean;
  onSelect: () => void;
  cardLabels: string[];
  archetypeRead: string;
}) => (
  <button
    type="button"
    className={[
      'seat-panel',
      seatClass,
      player.isHero ? 'hero' : '',
      player.folded ? 'folded' : '',
      activeTurn ? 'active-turn' : '',
      thinking ? 'is-thinking' : '',
      actionBadge ? 'has-acted' : '',
      selected ? 'selected' : ''
    ].filter(Boolean).join(' ')}
    onClick={onSelect}
    title={player.isHero ? 'Your seat' : `${player.profile}: ${archetypeRead}`}
    aria-pressed={selected}
  >
    <div className="seat-identity">
      <strong>{player.name}</strong>
      <div className="seat-meta">
        <CompactBadge tone={player.isHero ? 'hero' : 'default'}>{player.position}</CompactBadge>
        {!player.isHero && player.profile && (
          <CompactBadge title={archetypeRead}>{player.profile}</CompactBadge>
        )}
      </div>
    </div>
    <div className="seat-stack"><ChipStack amount={player.stack} /></div>
    <div className="seat-cards">
      {player.isHero
        ? cardLabels.map((cardLabel) => <PokerCard key={`${player.id}-${cardLabel}`} value={cardLabel} />)
        : player.holeCards.length > 0 && (
            <>
              <PokerCard hidden />
              <PokerCard hidden />
            </>
          )}
    </div>
    {thinking && <span className="seat-note">Thinking</span>}
    {actionBadge && !player.folded && <span className="action-badge">{actionBadge}</span>}
  </button>
);

export const StartSessionCard = ({
  expanded,
  bullets,
  onToggle,
  onDeal,
  disabled
}: {
  expanded: boolean;
  bullets: string[];
  onToggle: () => void;
  onDeal: () => void;
  disabled: boolean;
}) => (
  <section className="start-session-card">
    <div className="card-heading">
      <div>
        <p className="panel-kicker">Start Session</p>
        <h3>Take the seat</h3>
      </div>
      <button type="button" className="quiet-button" onClick={onToggle}>
        {expanded ? 'Minimize' : 'Show Tips'}
      </button>
    </div>
    <p className="compact-copy">Deal a spot, act quickly, then review only when you want depth.</p>
    {expanded && (
      <ul className="compact-list">
        {bullets.map((item) => <li key={item}>{item}</li>)}
      </ul>
    )}
    <button type="button" className="accent wide-button" onClick={onDeal} disabled={disabled}>
      Deal Next Hand
    </button>
  </section>
);

export const PaceControls = ({
  paceMode,
  onChange,
  paceHelp
}: {
  paceMode: PaceMode;
  onChange: (pace: PaceMode) => void;
  paceHelp: Record<PaceMode, string>;
}) => (
  <div className="pace-controls">
    <span className="control-label">Pace</span>
    <div className="pill-row">
      {(['Fast', 'Normal', 'Study'] as PaceMode[]).map((pace) => (
        <button
          key={pace}
          type="button"
          className={paceMode === pace ? 'active' : ''}
          onClick={() => onChange(pace)}
          title={paceHelp[pace]}
        >
          {pace}
        </button>
      ))}
    </div>
  </div>
);

export const HintPopover = ({
  visible,
  quick,
  detail,
  expanded,
  onToggle,
  onToggleExpanded
}: {
  visible: boolean;
  quick: string;
  detail: string;
  expanded: boolean;
  onToggle: () => void;
  onToggleExpanded: () => void;
}) => (
  <div className="hint-popover-shell">
    <button type="button" className="neutral" onClick={onToggle}>
      {visible ? 'Hide Hint' : 'Hint'}
    </button>
    {visible && (
      <div className="hint-popover">
        <strong>Coach nudge</strong>
        <p>{quick}</p>
        <button type="button" className="quiet-button" onClick={onToggleExpanded}>
          {expanded ? 'Hide detail' : 'Study note'}
        </button>
        {expanded && <p className="hint-detail">{detail}</p>}
      </div>
    )}
  </div>
);

export const ExpandableSidePanel = ({
  title,
  kicker,
  summary,
  open,
  onToggle,
  children,
  action
}: {
  title: string;
  kicker: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  action?: ReactNode;
}) => (
  <section className={`utility-panel ${open ? 'open' : ''}`}>
    <button
      type="button"
      className="utility-panel-toggle"
      aria-expanded={open}
      onClick={onToggle}
    >
      <div>
        <p className="panel-kicker">{kicker}</p>
        <h3>{title}</h3>
        <span className="utility-summary">{summary}</span>
      </div>
      <span className="status-affordance">{open ? 'Hide' : 'Open'}</span>
    </button>
    {action && <div className="utility-panel-action">{action}</div>}
    {open && <div className="utility-panel-body">{children}</div>}
  </section>
);

export const HandRecapPanel = ({
  summary,
  ratingTitle,
  showWhy,
  onToggleWhy,
  onOpenReplay
}: {
  summary?: HandSummary;
  ratingTitle?: string;
  showWhy: boolean;
  onToggleWhy: () => void;
  onOpenReplay: () => void;
}) => {
  if (!summary) {
    return <p className="compact-copy">No recap yet. Play a hand and the review rail will fill in.</p>;
  }

  return (
    <div className="recap-panel">
      <div className="recap-grid">
        <div className="recap-stat">
          <span>Hero</span>
          <strong>{summary.heroCards.map((card) => `${card.rank}${card.suit}`).join(' ')}</strong>
        </div>
        <div className="recap-stat">
          <span>Board</span>
          <strong>{summary.board.map((card) => `${card.rank}${card.suit}`).join(' ') || '-'}</strong>
        </div>
        <div className="recap-stat">
          <span>Result</span>
          <strong>{summary.resultBb.toFixed(1)} bb</strong>
        </div>
      </div>
      <div className="recap-timeline">
        {summary.actions.slice(0, 8).map((action, index) => (
          <span key={`${summary.id}-${index}`} className="timeline-chip">
            {action.street.slice(0, 1).toUpperCase()} {action.playerName} {action.type}
          </span>
        ))}
      </div>
      <div className="recap-grade-row">
        <span className="rating-pill" title={ratingTitle}>Grade: {summary.rating}</span>
        <button type="button" className="quiet-button" onClick={onOpenReplay}>Replay Last Hand</button>
      </div>
      <p className="compact-copy">{summary.feedback}</p>
      <button type="button" className="quiet-button" onClick={onToggleWhy}>
        {showWhy ? 'Hide breakdown' : 'Why this line?'}
      </button>
      {showWhy && (
        <div className="recap-notes">
          <p>{summary.why}</p>
          <p><strong>Tighter:</strong> {summary.tighter}</p>
          <p><strong>Pressure:</strong> {summary.aggressive}</p>
        </div>
      )}
    </div>
  );
};

export const ReplayControls = ({
  mode,
  onModeChange,
  modeLabel
}: {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  modeLabel: Record<Mode, string>;
}) => (
  <div className="mode-toggle-row">
    {(Object.keys(modeLabel) as Mode[]).map((entryMode) => (
      <button
        key={entryMode}
        type="button"
        className={mode === entryMode ? 'active' : ''}
        onClick={() => onModeChange(entryMode)}
      >
        {modeLabel[entryMode]}
      </button>
    ))}
  </div>
);

export const ReplayTimeline = ({
  steps,
  replayStep,
  onStepChange
}: {
  steps: ReplayStep[];
  replayStep: number;
  onStepChange: (step: number) => void;
}) => (
  <div className="timeline">
    {steps.map((step, index) => (
      <button
        key={`${step.street}-${step.who}-${index}`}
        type="button"
        className={`timeline-step ${index === replayStep ? 'active' : ''}`}
        onClick={() => onStepChange(index)}
      >
        <span>{step.street}</span>
        <strong>{step.who}</strong>
        <em>{step.did}</em>
        <small>Pot {step.potAfter}</small>
      </button>
    ))}
  </div>
);
