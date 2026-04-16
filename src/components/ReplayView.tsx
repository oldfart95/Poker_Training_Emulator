import type { Dispatch, SetStateAction } from 'react';
import type { ReplayStep } from '../training/replay';
import type { StrategyMode } from '../strategy/types';
import { CompactBadge, ReplayTimeline } from './TableLayout';

export function ReplayView({
  replayGuideBody,
  strategyMode,
  strategyModeLabel,
  setMode,
  modeTooltips,
  replayActions,
  replayStep,
  setReplayStep,
  currentReplay
}: {
  replayGuideBody: string;
  strategyMode: StrategyMode;
  strategyModeLabel: Record<StrategyMode, string>;
  setMode: (mode: 'full-ring' | 'replay') => void;
  modeTooltips: Record<'full-ring' | 'replay', string>;
  replayActions: ReplayStep[];
  replayStep: number;
  setReplayStep: Dispatch<SetStateAction<number>>;
  currentReplay?: ReplayStep;
}) {
  return (
    <section className="replay-shell">
      <div className="replay-header">
        <div>
          <p className="panel-kicker">Replay Last Hand</p>
          <h2>Street-by-street review</h2>
          <p className="tagline">{replayGuideBody}</p>
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

          <ReplayTimeline steps={replayActions} replayStep={replayStep} onStepChange={(step) => setReplayStep(step)} />

          <div className="replay-controls">
            <button type="button" onClick={() => setReplayStep((value) => Math.max(0, value - 1))}>Previous</button>
            <button type="button" onClick={() => setReplayStep((value) => Math.min(replayActions.length - 1, value + 1))}>Next</button>
          </div>
        </>
      )}
    </section>
  );
}
