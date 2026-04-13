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

export default function App() {
  const [mode, setMode] = useState<Mode>('full-ring');
  const [state, setState] = useState(() => runBotsUntilHero(beginHand(createInitialState())));
  const [replayStep, setReplayStep] = useState(0);
  const [betAmount, setBetAmount] = useState(250);
  const [showWhy, setShowWhy] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [drill, setDrill] = useState(() => nextDrillSpot('preflop-trainer'));

  const hero = state.players[0];
  const legal = legalActions(state, 0);

  const heroAction = (type: 'fold'|'check'|'call'|'raise'|'all-in', amount = 0) => {
    let s = applyAction(state, 0, type, amount);
    s = s.summary ? s : runBotsUntilHero(s);
    if (s.summary) s = runBotsUntilHero(beginHand(s));
    setState(s);
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
      <header>
        <h1>Pocket Pixel Poker</h1>
        <div className="menu">
          {(Object.keys(modeLabel) as Mode[]).map((m) => <button key={m} onClick={() => handleMode(m)}>{modeLabel[m]}</button>)}
        </div>
      </header>

      {mode === 'full-ring' && (
        <div className="layout">
          <section className="table">
            <div className="pot">Pot: {state.pot}</div>
            <div className="board">{state.board.map((c, i) => <span key={i} className="card">{formatCard(c)}</span>)}</div>
            <div className="seats">
              {state.players.map((p) => (
                <div className={`seat ${p.isHero ? 'hero' : ''} ${p.folded ? 'folded' : ''}`} key={p.id}>
                  <strong>{p.name}</strong>
                  <div>{p.position}</div>
                  <div>{p.stack} chips</div>
                  {!p.isHero && <div>{p.holeCards.length ? '🂠🂠' : ''}</div>}
                  {p.isHero && <div>{p.holeCards.map(formatCard).join(' ')}</div>}
                </div>
              ))}
            </div>

            <div className="actions">
              <button onClick={() => heroAction('fold')}>Fold</button>
              <button onClick={() => heroAction(legal.canCheck ? 'check' : 'call')}>{legal.canCheck ? 'Check' : `Call ${legal.toCall}`}</button>
              <button onClick={() => heroAction('raise', betAmount)}>Bet / Raise</button>
              <button onClick={() => heroAction('all-in')}>All-in</button>
              <input type="range" min={legal.minRaise} max={Math.max(legal.minRaise, legal.max)} value={Math.min(betAmount, Math.max(legal.minRaise, legal.max))} onChange={(e) => setBetAmount(Number(e.target.value))} />
              <div className="presets">{[0.25,0.33,0.5,0.75,1].map((s) => <button key={s} onClick={() => setBetAmount(Math.round(state.pot * s))}>{Math.round(s*100)}%</button>)}<button onClick={() => setBetAmount(Math.round(2.5*state.bb))}>2.5x</button><button onClick={() => setBetAmount(Math.round(3*state.bb))}>3x</button></div>
            </div>
          </section>

          <aside className="study">
            <h3>Study Recap</h3>
            {state.summary ? (
              <>
                <div>{state.summary.heroCards.map(formatCard).join(' ')} | {state.summary.heroPosition}</div>
                <div>Board: {state.summary.board.map(formatCard).join(' ')}</div>
                <div>Result: {state.summary.resultChips} chips ({state.summary.resultBb.toFixed(1)} bb)</div>
                <div>Rating: <strong>{state.summary.rating}</strong></div>
                <p>{state.summary.feedback}</p>
                <button onClick={() => setShowWhy((v) => !v)}>Why?</button>
                {showWhy && <p>{state.summary.why}</p>}
                <p><em>Tighter:</em> {state.summary.tighter}</p>
                <p><em>Aggressive:</em> {state.summary.aggressive}</p>
              </>
            ) : <p>Finish the hand to get coaching.</p>}

            <button onClick={() => setShowDebug((v) => !v)}>{showDebug ? 'Hide Debug' : 'Show Debug'}</button>
            {showDebug && state.botDebug && (
              <div>
                <h4>Bot Debug</h4>
                <div>Archetype: {state.botDebug.archetype}</div>
                <div>Hand bucket: {state.botDebug.bucket}</div>
                <div>Texture: {state.botDebug.texture}</div>
                <div>Reason: {state.botDebug.reason}</div>
                <div className="debug-weights">
                  {Object.entries(state.botDebug.weights).map(([k,v]) => <span key={k}>{k}:{v.toFixed(2)} </span>)}
                </div>
              </div>
            )}

            <h4>Session Stats</h4>
            <ul>
              <li>VPIP: {state.stats.vpipOpportunities ? ((state.stats.vpipCount/state.stats.vpipOpportunities)*100).toFixed(1) : 0}%</li>
              <li>PFR: {state.stats.pfrOpportunities ? ((state.stats.pfrCount/state.stats.pfrOpportunities)*100).toFixed(1) : 0}%</li>
              <li>Win/Loss: {state.stats.winLossBb.toFixed(1)} bb</li>
              <li>WTSD: {state.stats.hands ? ((state.stats.wtsdCount/state.stats.hands)*100).toFixed(1) : 0}%</li>
            </ul>
          </aside>
        </div>
      )}

      {mode !== 'full-ring' && mode !== 'replay' && drill && (
        <section className="drill">
          <h2>{modeLabel[mode]}</h2>
          <p>{drill.prompt}</p>
          <div>Hero: {drill.heroCards.map(formatCard).join(' ')} {drill.board ? `| Board: ${drill.board.map(formatCard).join(' ')}` : ''}</div>
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
