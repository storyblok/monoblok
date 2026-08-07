import type { DiffResult, RemoteSchemaData, SchemaData } from '../../types';
import type { BreakingChange, ComponentBreakingChanges, RenameMatch } from './types';

/** Fields treated as internal Storyblok sentinels — never part of user-defined schema. */
const SENTINEL_FIELDS = new Set(['_uid', 'component']);

/** Classification of field-level changes between remote and local component schemas. */
export interface FieldClassification {
  removed: { field: string; type: string }[];
  added: { field: string; type: string; required: boolean }[];
  typeChanged: { field: string; oldType: string; newType: string }[];
  requiredAdded: { field: string; type: string }[];
  requiredChanged: { field: string; type: string }[];
}

/**
 * Compares two component schema objects field-by-field and classifies changes.
 *
 * @param remoteSchema - The schema fields currently stored on the Storyblok space.
 * @param localSchema - The schema fields defined locally.
 * @returns Classified field changes: removed, added, typeChanged, requiredAdded.
 */
export function classifyFieldChanges(
  remoteSchema: Record<string, { type?: string; required?: boolean }>,
  localSchema: Record<string, { type?: string; required?: boolean }>,
): FieldClassification {
  const removed: FieldClassification['removed'] = [];
  const added: FieldClassification['added'] = [];
  const typeChanged: FieldClassification['typeChanged'] = [];
  const requiredAdded: FieldClassification['requiredAdded'] = [];
  const requiredChanged: FieldClassification['requiredChanged'] = [];

  // Fields in remote but not in local → removed
  for (const [field, remoteField] of Object.entries(remoteSchema)) {
    if (SENTINEL_FIELDS.has(field)) { continue; }
    if (typeof remoteField.type !== 'string') { continue; }
    if (!(field in localSchema)) {
      removed.push({ field, type: remoteField.type });
    }
  }

  // Fields in local but not in remote → added or requiredAdded
  // Fields in both but with different type → typeChanged
  // Fields in both where required changed from falsy to true → requiredChanged
  for (const [field, localField] of Object.entries(localSchema)) {
    if (SENTINEL_FIELDS.has(field)) { continue; }
    if (typeof localField.type !== 'string') { continue; }
    if (!(field in remoteSchema)) {
      if (localField.required) {
        requiredAdded.push({ field, type: localField.type });
      }
      else {
        added.push({ field, type: localField.type, required: false });
      }
    }
    else {
      const remoteField = remoteSchema[field];
      if (typeof remoteField?.type !== 'string') { continue; }
      if (remoteField.type !== localField.type) {
        typeChanged.push({ field, oldType: remoteField.type, newType: localField.type });
      }
      if (localField.required && !remoteField.required) {
        requiredChanged.push({ field, type: localField.type });
      }
    }
  }

  return { removed, added, typeChanged, requiredAdded, requiredChanged };
}

/** Result of rename detection for a set of removed and added fields. */
export interface RenameDetectionResult {
  renames: RenameMatch[];
  unmatchedRemoved: FieldClassification['removed'];
  unmatchedAdded: FieldClassification['added'];
}

/**
 * Computes the length of the longest common substring between two strings.
 *
 * @param a - First string.
 * @param b - Second string.
 * @returns Length of the longest common substring.
 */
function longestCommonSubstring(a: string, b: string): number {
  let maxLen = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      let len = 0;
      while (i + len < a.length && j + len < b.length && a[i + len] === b[j + len]) {
        len++;
      }
      if (len > maxLen) { maxLen = len; }
    }
  }
  return maxLen;
}

/**
 * Computes a name similarity score in [0, 1] using longest common substring
 * divided by the length of the longer string.
 */
function nameSimilarity(a: string, b: string): number {
  const longer = Math.max(a.length, b.length);
  if (longer === 0) { return 1; }
  return longestCommonSubstring(a, b) / longer;
}

/**
 * Matches removed and added fields as likely renames using type equality as
 * the primary signal and name similarity as a tiebreaker.
 *
 * When exactly one field is removed and exactly one is added (and they share
 * the same type), the pair is treated as a rename regardless of name
 * similarity — a single 1-for-1 swap is overwhelmingly a rename in practice.
 *
 * @param removed - Fields present in remote but absent in local.
 * @param added - Fields present in local but absent in remote (non-required).
 * @returns Matched rename pairs plus the unmatched remainders.
 */
export function detectRenames(
  removed: FieldClassification['removed'],
  added: FieldClassification['added'],
): RenameDetectionResult {
  const renames: RenameMatch[] = [];
  const usedRemoved = new Set<string>();
  const usedAdded = new Set<string>();

  // Group added fields by type for efficient candidate lookup
  const addedByType = new Map<string, FieldClassification['added']>();
  for (const addedField of added) {
    if (!addedByType.has(addedField.type)) {
      addedByType.set(addedField.type, []);
    }
    addedByType.get(addedField.type)!.push(addedField);
  }

  const isSinglePair = removed.length === 1 && added.length === 1;

  for (const removedField of removed) {
    const candidates = addedByType.get(removedField.type) ?? [];
    const availableCandidates = candidates.filter(c => !usedAdded.has(c.field));
    if (availableCandidates.length === 0) { continue; }

    // Pick the candidate with the highest name similarity
    let bestCandidate = availableCandidates[0];
    let bestScore = nameSimilarity(removedField.field, bestCandidate.field);
    for (let i = 1; i < availableCandidates.length; i++) {
      const score = nameSimilarity(removedField.field, availableCandidates[i].field);
      if (score > bestScore) {
        bestScore = score;
        bestCandidate = availableCandidates[i];
      }
    }

    if (!isSinglePair && bestScore < 0.3) { continue; }

    renames.push({ oldField: removedField.field, newField: bestCandidate.field, fieldType: removedField.type });
    usedRemoved.add(removedField.field);
    usedAdded.add(bestCandidate.field);
  }

  const unmatchedRemoved = removed.filter(r => !usedRemoved.has(r.field));
  const unmatchedAdded = added.filter(a => !usedAdded.has(a.field));

  return { renames, unmatchedRemoved, unmatchedAdded };
}

/**
 * Analyzes all updated components for breaking field-level changes.
 * Only processes diffs with action `update` for entity type `component`.
 *
 * @param diffResult - The result of comparing local and remote schemas.
 * @param local - The local schema data.
 * @param remote - The remote schema data fetched from the Storyblok space.
 * @returns An array of per-component breaking changes (only components with at least one breaking change are included).
 */
export function analyzeBreakingChanges(
  diffResult: DiffResult,
  local: SchemaData,
  remote: RemoteSchemaData,
): ComponentBreakingChanges[] {
  const results: ComponentBreakingChanges[] = [];

  const updatedComponents = diffResult.diffs.filter(
    d => d.type === 'component' && d.action === 'update',
  );

  for (const diff of updatedComponents) {
    const localComp = local.components.find(c => c.name === diff.name);
    const remoteComp = remote.components.get(diff.name);

    if (!localComp?.schema || !remoteComp?.schema) { continue; }

    const classification = classifyFieldChanges(
      remoteComp.schema as Record<string, Record<string, unknown>>,
      localComp.schema as Record<string, Record<string, unknown>>,
    );

    const changes: BreakingChange[] = [];

    // Detect renames from removed+added pairs (non-required only — required
    // additions signal developer intent for a new field, not a rename)
    const { renames, unmatchedRemoved } = detectRenames(classification.removed, classification.added);

    for (const rename of renames) {
      changes.push({ kind: 'rename', field: rename.newField, oldField: rename.oldField });
    }

    for (const removed of unmatchedRemoved) {
      changes.push({ kind: 'removed', field: removed.field });
    }

    for (const tc of classification.typeChanged) {
      changes.push({ kind: 'type_changed', field: tc.field, oldType: tc.oldType, newType: tc.newType });
    }

    for (const ra of classification.requiredAdded) {
      changes.push({ kind: 'required_added', field: ra.field, fieldType: ra.type });
    }

    for (const rc of classification.requiredChanged) {
      changes.push({ kind: 'required_changed', field: rc.field, fieldType: rc.type });
    }

    if (changes.length > 0) {
      results.push({ componentName: diff.name, changes });
    }
  }

  return results;
}
