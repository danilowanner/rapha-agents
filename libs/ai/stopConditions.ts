import { stepCountIs, type StopCondition, type ToolSet } from "ai";

/**
 * Stops when any tool result contains `done: true`.
 */
export const toolResultDone =
  <TOOLS extends ToolSet>(): StopCondition<TOOLS> =>
  (event) =>
    event.steps.some((step) =>
      step.toolResults.some(
        (tr) =>
          !tr.dynamic &&
          typeof tr.output === "object" &&
          tr.output !== null &&
          "done" in tr.output &&
          tr.output.done === true
      )
    );

/**
 * Combines multiple stop conditions with OR logic.
 */
export const stopWhenAny =
  <TOOLS extends ToolSet>(...conditions: StopCondition<TOOLS>[]): StopCondition<TOOLS> =>
  (event) =>
    conditions.some((condition) => condition(event));

/**
 * Creates a stop condition that triggers on tool result done OR max step count.
 */
export const stopOnDoneOrMaxSteps = <TOOLS extends ToolSet>(maxSteps: number): StopCondition<TOOLS> =>
  stopWhenAny(toolResultDone<TOOLS>(), stepCountIs(maxSteps) as StopCondition<TOOLS>);
