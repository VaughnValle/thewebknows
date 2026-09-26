import { CHECKLIST } from './checklist';
import type { Candidate } from '../platforms/candidates';
import type { ApiObservation } from '../checks';
import type { LookupState, SessionState } from '../session/state';
import type { ChecklistQuestionId, PlatformId } from '../types';

/**
 * Where a field-level statement comes from.
 *  - api:          returned by a supported public API ("API-confirmed")
 *  - api-empty:    the API covers this field and returned nothing for it
 *  - user-yes:     you marked this public
 *  - user-no:      you marked this as not shown
 *  - not-checked:  nobody checked
 */
export type Provenance = 'api' | 'api-empty' | 'user-yes' | 'user-no' | 'not-checked';

export const PROVENANCE_LABEL: Record<Provenance, string> = {
  api: 'API-confirmed',
  'api-empty': 'Empty in API data',
  'user-yes': 'You marked this public',
  'user-no': 'You marked this not shown',
  'not-checked': 'Not checked',
};

/** Fields each API adapter reliably covers, so "empty" is a real statement. */
const API_COVERAGE: Partial<Record<PlatformId, ChecklistQuestionId[]>> = {
  github: ['name', 'affiliation', 'contact', 'linked'],
  bluesky: ['name'],
};

export interface FieldRow {
  question: ChecklistQuestionId;
  field: string;
  provenance: Provenance;
  /** API-returned values backing an "api" row (screen only unless export opts in). */
  apiValues: ApiObservation[];
  /** User said "no" but the API returned something — worth a second look. */
  conflict: boolean;
}

export function apiObservations(lookup: LookupState | undefined): ApiObservation[] {
  return lookup && lookup.status === 'api-returned' ? lookup.observations : [];
}

export function fieldRows(candidate: Candidate, state: Pick<SessionState, 'lookups' | 'checklist'>): FieldRow[] {
  const lookup = state.lookups[candidate.id];
  const observations = apiObservations(lookup);
  const answers = state.checklist[candidate.id] ?? {};
  const apiReturned = lookup?.status === 'api-returned';

  return CHECKLIST.map((q) => {
    const apiValues = observations.filter((o) => q.apiCategories.includes(o.category));
    const answer = answers[q.id];
    let provenance: Provenance = 'not-checked';
    if (apiValues.length) provenance = 'api';
    else if (answer === 'yes') provenance = 'user-yes';
    else if (answer === 'no') provenance = 'user-no';
    else if (apiReturned && API_COVERAGE[candidate.platform]?.includes(q.id)) provenance = 'api-empty';
    return { question: q.id, field: q.field, provenance, apiValues, conflict: apiValues.length > 0 && answer === 'no' };
  });
}

/** True when a field is shown publicly according to the API or the user. */
export const isShown = (row: FieldRow) => row.provenance === 'api' || row.provenance === 'user-yes';
