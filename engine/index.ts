/**
 * Registry of engine versions. A reading stores its `engine_version`, and that string must resolve for as long as
 * the link lives (law 1 in CLAUDE.md): a new formula is a new folder registered here, never an edit of an old one.
 */
import * as v1 from "./v1/index";

export interface Engine {
  version: string;
  computeSteps: typeof v1.computeSteps;
  forecastFromCards: typeof v1.forecastFromCards;
  accuracy: typeof v1.accuracy;
  atr: typeof v1.atr;
  cardById: typeof v1.cardById;
}

export const ENGINES: Readonly<Record<string, Engine>> = {
  [v1.ENGINE_VERSION]: {
    version: v1.ENGINE_VERSION,
    computeSteps: v1.computeSteps,
    forecastFromCards: v1.forecastFromCards,
    accuracy: v1.accuracy,
    atr: v1.atr,
    cardById: v1.cardById,
  },
};

export function engineFor(version: string): Engine {
  const engine = Object.hasOwn(ENGINES, version) ? ENGINES[version] : undefined;
  if (engine === undefined) throw new RangeError(`unknown engine version "${version}"`);
  return engine;
}
