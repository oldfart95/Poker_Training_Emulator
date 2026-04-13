import { decideBlueprintAction } from './blueprint/blueprintStrategy';
import { decideExploitAction } from './exploit/exploitStrategy';
import { StrategyContext } from './types';

export const decideStrategyAction = (context: StrategyContext) => {
  if (context.mode === 'exploit') return decideExploitAction(context);
  return decideBlueprintAction(context);
};
