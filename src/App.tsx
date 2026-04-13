import { useMemo, useState } from 'react';
import { applyAction, beginHand, createInitialState, legalActions, runBotsUntilHero } from './engine/gameEngine';
import { formatCard } from './engine/deck';
import { Mode } from './engine/types';
import { nextDrillSpot } from './training/drills';

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

export default function App() {
  const [mode, setMode] = useState<Mode>('full-ring');
  const [state, setState] = useState(() => runBotsUntilHero(beginHand(createInitialState())));
  const [replayStep, setReplayStep] = useState(0);
  const [betAmount, setBetAmount] = useState(250);
  const [showWhy, setShowWhy] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [drill, setDrill] = useState(() => nextDrillSpot('preflop-trainer'));

  const legal = legalActions(state, 0);
  const canRaise = legal.max >= legal.minRaise && !state.summary;
  const lastAction = state.actions[state.actions.length - 1];

  const heroAction = (type: 'fold' | 'check' | 'call' | 'raise' | 'all-in', amount = 0) => {
    let s = applyAction(state, 0, type, amount);
    s = s.summary ? s : runBotsUntilHero(s);
    setState(s);
    setReplayStep(0);
  };

  const dealNextHand = () => {
    setState((prev) => runBotsUntilHero(beginHand(prev)));
    setReplayStep(0);
  };

  const handleMode = (m: Mode) => {
    setMode(m);
    if (m === 'full-ring') return;
    if (m === 'replay') return;
    setDrill(nextDrillSpot(m));
  };

  const replayActions = useMemo(() => state.summary?.actions ?? [], [state.summary]);

  return (
    <div className="app">
      <header className="top-bar">
        <div>
          <h1>Pocket Pixel Poker</h1>
          <p className="tagline">Cozy pixel cardroom • serious hand study</p>
        </div>
        <div className="menu">
          {(Object.keys(modeLabel) as Mode[]).map((m) => (
            <button key={m} className={mode === m ? 'active' : ''} onClick={() => handleMode(m)}>
              {modeLabel[m]}
            </button>
          ))}
        </div>
      </header>

      {mode === 'full-ring' && (
        <div className="layout">
          <section className="table-shell">
            <div className={`table-surface street-${state.street}`}>
              <div className="table-vignette" />
              <div className="pot-plaque">
                <span className="label">Main Pot</span>
                <div key={`${state.handId}-${state.pot}`} className="pot-pop">
                  <ChipStack amount={state.pot} />
                </div>
              </div>
              {lastAction && !state.summary && <div key={`${state.handId}-${state.actions.length}`} className={`chip-trail seat-${lastAction.seat}`} />}
              <div className={`street-banner ${state.street}`}>
                <span>{streetMeta[state.street].icon}</span> {streetMeta[state.street].label}
              </div>
              <div className="board-lane" key={`${state.handId}-${state.board.length}`}>
                {state.board.length === 0 && <span className="street-hint">Waiting for flop...</span>}
                {state.board.map((c, i) => (
                  <PokerCard key={`${c.rank}${c.suit}${i}`} value={formatCard(c)} />
                ))}
              </div>

              <div className="seats-ring">
                {state.players.map((p, index) => (
                  <article
                    className={`seat-panel ${seatClass[index]} ${p.isHero ? 'hero' : ''} ${p.folded ? 'folded' : ''} ${state.currentSeat === index && !state.summary ? 'active-turn' : ''}`}
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
                    {lastAction?.seat === index && !state.summary && (
                      <div key={`${state.handId}-${state.actions.length}`} className="action-badge">{lastAction.type.toUpperCase()}</div>
                    )}
                  </article>
                ))}
              </div>
            </div>

            <div className="action-dock">
              <div className="primary-actions">
                <button className="danger" disabled={!!state.summary} onClick={() => heroAction('fold')}>
                  Fold
                </button>
                <button
                  className={`neutral ${legal.canCheck ? 'soft' : ''}`}
                  disabled={!!state.summary}
                  onClick={() => heroAction(legal.canCheck ? 'check' : 'call')}
                >
                  {legal.canCheck ? 'Check' : `Call ${legal.toCall}`}
                </button>
                <button className="accent" disabled={!canRaise} onClick={() => heroAction('raise', betAmount)}>
                  Bet / Raise
                </button>
                <button className="gold" disabled={!!state.summary} onClick={() => heroAction('all-in')}>
                  All-in
                </button>
              </div>

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
                    <button key={s} onClick={() => setBetAmount(Math.round(state.pot * s))}>
                      {Math.round(s * 100)}%
                    </button>
                  ))}
                  <button onClick={() => setBetAmount(Math.round(2.5 * state.bb))}>2.5x</button>
                  <button onClick={() => setBetAmount(Math.round(3 * state.bb))}>3x</button>
                </div>
              </div>
              {state.summary && (
                <button className="deal-next" onClick={dealNextHand}>
                  Deal Next Hand
                </button>
              )}
            </div>
          </section>

          <aside className="study-panel">
            <h3>Study Recap</h3>
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
                <div className="rating-pill">Rating: {state.summary.rating}</div>
                <p>{state.summary.feedback}</p>
                <button className="neutral" onClick={() => setShowWhy((v) => !v)}>
                  {showWhy ? 'Hide Why' : 'Why this line?'}
                </button>
                {showWhy && <p>{state.summary.why}</p>}
                <p><em>Tighter:</em> {state.summary.tighter}</p>
                <p><em>Aggressive:</em> {state.summary.aggressive}</p>
              </div>
            ) : (
              <p className="coach-placeholder">Complete the hand to unlock coaching notes and rating.</p>
            )}

            <div className="debug-wrap">
              <button className="debug-toggle" onClick={() => setShowDebug((v) => !v)}>
                {showDebug ? 'Hide Debug Tools' : 'Show Debug Tools'}
              </button>
              {showDebug && state.botDebug && (
                <div className="debug-panel">
                  <h4>Bot Debug</h4>
                  <div>Archetype: {state.botDebug.archetype}</div>
                  <div>Hand bucket: {state.botDebug.bucket}</div>
                  <div>Texture: {state.botDebug.texture}</div>
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
          <h2>{modeLabel[mode]}</h2>
          <p>{drill.prompt}</p>
          <div>
            Hero: {drill.heroCards.map(formatCard).join(' ')} {drill.board ? `| Board: ${drill.board.map(formatCard).join(' ')}` : ''}
          </div>
          <div>{drill.choices.map((c) => <button key={c} onClick={() => setDrill(nextDrillSpot(mode))}>{c}</button>)}</div>
          <p>Coach note: {drill.note}</p>
        </section>
      )}

      {mode === 'replay' && (
        <section className="drill">
          <h2>Replay Last Hand</h2>
          <p>Step {replayStep + 1} / {Math.max(replayActions.length, 1)}</p>
          {replayActions[replayStep] && <p>{replayActions[replayStep].street.toUpperCase()}: {replayActions[replayStep].playerName} {replayActions[replayStep].type} {replayActions[replayStep].amount}</p>}
          <button onClick={() => setReplayStep((s) => Math.max(0, s - 1))}>Prev</button>
          <button onClick={() => setReplayStep((s) => Math.min(replayActions.length - 1, s + 1))}>Next</button>
        </section>
      )}
    </div>
  );
}
