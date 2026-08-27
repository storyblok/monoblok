/**
 * The pipe: how one CLI command's results reach the next one.
 *
 * JSONL on stdout, `-` and JSONL on stdin, the line contract the two agree on,
 * and the staged-run instrumentation that goes with a streaming command. All of
 * it is about the pipe rather than about what is being piped, so a second
 * command joining it reuses this instead of growing its own copy.
 */
export {
  createStoryLineSource,
  describeStoryLine,
  hasContent,
  isSidecarKey,
  parseStoryLine,
  REQUIRED_STORY_LINE_FIELDS,
  SIDECAR_PREFIX,
  stripSidecarKeys,
} from "./contract";
export type { StoryLine } from "./contract";
export {
  createJsonlSource,
  hasPipedStdin,
  isStdinArgument,
  probeStdin,
  STDIN_ARGUMENT,
} from "./input";
export type { StdinKind } from "./input";
export {
  createCollectingSink,
  createJsonlOutput,
  DownstreamClosedError,
  isDownstreamClosed,
} from "./output";
export type { LineWriter, MachineOutput } from "./output";
export { createPhaseTracker, formatMark, toPhaseSummary } from "./phases";
export type { Phase, PhaseCounts, PhaseDefinition, PhaseTracker } from "./phases";
