import { createContext, useCallback, useContext, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { CheckService } from '../lib/checks';
import { generateCandidates, splitUsernamesAndLinks, type Candidate } from '../lib/platforms/candidates';
import { initialState, reducer, type Action, type SessionState } from '../lib/session/state';

interface SessionApi {
  state: SessionState;
  dispatch: (action: Action) => void;
  startRun: () => { ok: boolean; message?: string };
  recheck: (candidate: Candidate) => void;
  clear: () => void;
  /** Increments on every clear, so anything keyed on it starts fresh. */
  generation: number;
}

const Ctx = createContext<SessionApi | null>(null);

/**
 * All session state lives here, in memory. Nothing is written to localStorage,
 * cookies, the URL, or any server. Clearing replaces the state and the check
 * service (its cache and rate-limit memory) with fresh ones.
 */
export function SessionProvider({ children, createService = () => new CheckService() }: {
  children: ReactNode;
  createService?: () => CheckService;
}) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [generation, setGeneration] = useState(0);
  const serviceRef = useRef<CheckService | null>(null);
  if (!serviceRef.current) serviceRef.current = createService();
  // Bumped on clear so late responses from a previous session are dropped.
  const epochRef = useRef(0);
  const stateRef = useRef(state);
  stateRef.current = state;

  const runCheck = useCallback((candidate: Candidate, force: boolean) => {
    if (candidate.kind !== 'api' || !candidate.handle) return;
    const epoch = epochRef.current;
    dispatch({ type: 'lookupStarted', id: candidate.id, now: Date.now() });
    serviceRef.current!
      .check(candidate.platform, candidate.handle, { force })
      .then((result) => {
        if (epochRef.current === epoch) dispatch({ type: 'lookupFinished', id: candidate.id, result });
      })
      .catch(() => {
        if (epochRef.current === epoch) {
          dispatch({
            type: 'lookupFinished',
            id: candidate.id,
            result: { status: 'unable', checkedAt: Date.now(), reason: 'server', detail: 'Something went wrong while checking.' },
          });
        }
      });
  }, []);

  const startRun = useCallback(() => {
    const { input, lookups } = stateRef.current;
    const { usernames, links } = splitUsernamesAndLinks(input.usernamesText, input.linksText);
    if (!usernames.length && !links.length) {
      return { ok: false, message: 'Add at least one username or profile link to start.' };
    }
    const set = generateCandidates({ usernames, links, displayName: input.displayName, platforms: input.platforms });
    if (!set.platforms.length) {
      return { ok: false, message: 'Choose at least one platform to check.' };
    }
    dispatch({ type: 'startRun', set, now: Date.now() });
    for (const c of set.candidates) {
      const prior = lookups[c.id];
      if (c.kind === 'api' && (!prior || prior.status === 'unable')) runCheck(c, false);
    }
    return { ok: true };
  }, [runCheck]);

  const recheck = useCallback((c: Candidate) => runCheck(c, true), [runCheck]);

  const clear = useCallback(() => {
    epochRef.current++;
    serviceRef.current = createService();
    dispatch({ type: 'clear' });
    setGeneration((g) => g + 1);
  }, [createService]);

  const value = useMemo(
    () => ({ state, dispatch, startRun, recheck, clear, generation }),
    [state, startRun, recheck, clear, generation],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession outside SessionProvider');
  return v;
}
