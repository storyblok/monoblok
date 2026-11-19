/**
 * The pipe: how one CLI command's results reach the next one.
 *
 * JSONL on stdout, the line contract a consumer can rely on, and the
 * staged-run instrumentation that goes with a streaming command. All of it is
 * about the pipe rather than about what is being piped, so a second command
 * joining it reuses this instead of growing its own copy.
 */
export { isSidecarKey, REQUIRED_STORY_LINE_FIELDS, SIDECAR_PREFIX } from "./contract";
export type { ResourceLine, ResultLine, StoryLine } from "./contract";
export { MalformedInputError, readRecords } from "./input";
export type { InputRecord } from "./input";
export {
  createCollectingSink,
  createJsonlOutput,
  createResultOutput,
  createTableOutput,
  DownstreamClosedError,
  isDeliberateStop,
  isDownstreamClosed,
  isLimitReached,
  LimitReachedError,
} from "./output";
export type { LineWriter, MachineOutput } from "./output";
export { createPhaseTracker, formatDuration, toPhaseSummary } from "./phases";
export type { Phase, PhaseCounts, PhaseDefinition, PhaseTracker } from "./phases";
