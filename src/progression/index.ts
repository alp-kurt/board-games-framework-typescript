export {
  defineTrack,
  advanceTrack,
  type TrackMilestone,
  type ProgressTrack,
} from "./track.js";
export {
  evaluateSets,
  type SetMatcher,
  type EvaluateSetsInput,
  type SetScore,
} from "./sets.js";
export { mutateGameState, type LegacyPatch } from "./legacy.js";
export {
  checkEndTriggers,
  calculateFinalScore,
  type EndTrigger,
  type EndTriggerResult,
  type ScoreRule,
} from "./victory.js";
