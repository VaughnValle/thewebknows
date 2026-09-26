import type { CandidateSet } from '../platforms/candidates';
import type { CheckResult } from '../checks';
import {
  PLATFORM_ORDER,
  type ChecklistAnswer,
  type ChecklistQuestionId,
  type IdentityStatus,
  type PlatformId,
  type PrivacyGoal,
} from '../types';

export type Step = 'start' | 'review' | 'summary';
export type ProfilePlan = 'keep' | 'edit' | 'delete';

export type LookupState = { status: 'checking'; startedAt: number } | CheckResult;

export interface SessionInput {
  usernamesText: string;
  linksText: string;
  displayName: string;
  platforms: PlatformId[];
  goal: PrivacyGoal | null;
}

export interface SessionState {
  step: Step;
  input: SessionInput;
  run: (CandidateSet & { startedAt: number }) | null;
  lookups: Record<string, LookupState>;
  identity: Record<string, IdentityStatus>;
  opened: Record<string, true>;
  checklist: Record<string, Partial<Record<ChecklistQuestionId, ChecklistAnswer>>>;
  plans: Record<string, ProfilePlan>;
  /** Action ids the user says they've completed. User-reported only. */
  done: Record<string, true>;
}

export const initialState = (): SessionState => ({
  step: 'start',
  input: { usernamesText: '', linksText: '', displayName: '', platforms: [...PLATFORM_ORDER], goal: null },
  run: null,
  lookups: {},
  identity: {},
  opened: {},
  checklist: {},
  plans: {},
  done: {},
});

export type Action =
  | { type: 'input'; patch: Partial<SessionInput> }
  | { type: 'togglePlatform'; platform: PlatformId }
  | { type: 'startRun'; set: CandidateSet; now: number }
  | { type: 'lookupStarted'; id: string; now: number }
  | { type: 'lookupFinished'; id: string; result: CheckResult }
  | { type: 'identity'; id: string; value: IdentityStatus }
  | { type: 'opened'; id: string }
  | { type: 'checklist'; id: string; question: ChecklistQuestionId; answer: ChecklistAnswer | null }
  | { type: 'plan'; id: string; plan: ProfilePlan | null }
  | { type: 'done'; actionId: string; value: boolean }
  | { type: 'step'; step: Step }
  | { type: 'clear' };

function without<T>(record: Record<string, T>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
}

export function reducer(state: SessionState, action: Action): SessionState {
  switch (action.type) {
    case 'input':
      return { ...state, input: { ...state.input, ...action.patch } };
    case 'togglePlatform': {
      const has = state.input.platforms.includes(action.platform);
      const platforms = has
        ? state.input.platforms.filter((p) => p !== action.platform)
        : PLATFORM_ORDER.filter((p) => p === action.platform || state.input.platforms.includes(p));
      return { ...state, input: { ...state.input, platforms } };
    }
    case 'startRun': {
      // A new run keeps decisions for candidates that still exist (same id).
      const ids = new Set(action.set.candidates.map((c) => c.id));
      const keep = <T,>(r: Record<string, T>) => Object.fromEntries(Object.entries(r).filter(([k]) => ids.has(k)));
      return {
        ...state,
        step: 'review',
        run: { ...action.set, startedAt: action.now },
        lookups: keep(state.lookups),
        identity: keep(state.identity),
        opened: keep(state.opened),
        checklist: keep(state.checklist),
        plans: keep(state.plans),
      };
    }
    case 'lookupStarted':
      return { ...state, lookups: { ...state.lookups, [action.id]: { status: 'checking', startedAt: action.now } } };
    case 'lookupFinished': {
      const lookups = { ...state.lookups, [action.id]: action.result };
      // "Not found" can't be claimed as yours; clear any earlier identity answer.
      const identity = action.result.status === 'not-found' ? without(state.identity, action.id) : state.identity;
      return { ...state, lookups, identity };
    }
    case 'identity': {
      const identity = { ...state.identity, [action.id]: action.value };
      // Checklist and plans only make sense for profiles marked as yours.
      if (action.value !== 'mine') {
        return { ...state, identity, checklist: without(state.checklist, action.id), plans: without(state.plans, action.id) };
      }
      return { ...state, identity };
    }
    case 'opened':
      return { ...state, opened: { ...state.opened, [action.id]: true } };
    case 'checklist': {
      const current = { ...(state.checklist[action.id] ?? {}) };
      if (action.answer === null) delete current[action.question];
      else current[action.question] = action.answer;
      return { ...state, checklist: { ...state.checklist, [action.id]: current } };
    }
    case 'plan':
      return {
        ...state,
        plans: action.plan === null ? without(state.plans, action.id) : { ...state.plans, [action.id]: action.plan },
      };
    case 'done':
      return { ...state, done: action.value ? { ...state.done, [action.actionId]: true } : without(state.done, action.actionId) };
    case 'step':
      return { ...state, step: action.step };
    case 'clear':
      return initialState();
  }
}
