// Messages between the Visual Editor and the plugin.

export const accessibilityProtocolVersion = 1;

export type AccessibilityCheckRequest = {
  action: "accessibilityCheck";
  requestId: string;
};

export type AccessibilityHighlightRequest = {
  action: "accessibilityHighlight";
  /** `null` clears the highlight. */
  findingId: string | null;
};

export type AccessibilityReadyMessage = {
  action: "accessibilityReady";
  protocolVersion: number;
  pluginVersion: string;
};

export type AccessibilityCheckResultMessage = {
  action: "accessibilityCheckResult";
  requestId: string;
  protocolVersion: number;
  result: AccessibilityCheckResult;
};

export type AccessibilityCheckErrorMessage = {
  action: "accessibilityCheckError";
  requestId: string;
  protocolVersion: number;
  error: { code: "check-failed" | "check-in-progress"; message: string };
};

export type AccessibilityFindingStatus = "violations" | "warnings" | "passed";

export type AccessibilityCategoryId =
  | "aria"
  | "color"
  | "forms"
  | "keyboard"
  | "language"
  | "name-role-value"
  | "parsing"
  | "semantics"
  | "sensory-and-visual-cues"
  | "structure"
  | "tables"
  | "text-alternatives"
  | "time-and-media"
  | "other";

export type AccessibilityFinding = {
  /** Unique within one check; used for highlight requests. */
  id: string;
  ruleId: string;
  title: string;
  description: string;
  helpUrl: string;
  /** Violations and warnings only. */
  severity?: "minor" | "moderate" | "serious" | "critical";
  element: {
    /** Truncated to 200 characters. Render it as text, never as HTML. */
    html: string;
    blockUid?: string;
    componentName?: string;
  };
};

export type AccessibilityCategory = {
  id: AccessibilityCategoryId;
  findings: Record<AccessibilityFindingStatus, AccessibilityFinding[]>;
};

export type AccessibilityCheckResult = {
  checkedAt: string;
  url: string;
  totalChecks: number;
  counts: Record<AccessibilityFindingStatus, number>;
  categories: AccessibilityCategory[];
};
