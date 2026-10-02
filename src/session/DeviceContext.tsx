import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { collectBasic, collectExtras, type Signals } from '../lib/device/collect';
import { buildItems, type ReportItem } from '../lib/device/report';
import { fetchWhoAmI, type WhoAmI } from '../lib/device/whoami';

export type WhoStatus = 'loading' | 'ok' | 'unavailable';

interface DeviceApi {
  signals: Signals | null;
  who: WhoAmI | null;
  whoStatus: WhoStatus;
  extrasReady: boolean;
  items: ReportItem[];
}

const Ctx = createContext<DeviceApi>({ signals: null, who: null, whoStatus: 'loading', extrasReady: false, items: [] });

export interface DeviceLoaders {
  basic: () => Signals;
  extras: (s: Signals) => Promise<Signals>;
  whoami: () => Promise<WhoAmI | null>;
}

const defaultLoaders: DeviceLoaders = { basic: collectBasic, extras: collectExtras, whoami: () => fetchWhoAmI() };

/**
 * Reads what this browser and connection reveal, once, in memory only.
 * Remounted (and so re-read) when the session is cleared.
 */
export function DeviceProvider({ children, loaders: given }: { children: ReactNode; loaders?: DeviceLoaders }) {
  const loaders = given ?? defaultLoaders;
  const [signals, setSignals] = useState<Signals | null>(null);
  const [extrasReady, setExtrasReady] = useState(false);
  const [who, setWho] = useState<WhoAmI | null>(null);
  const [whoStatus, setWhoStatus] = useState<WhoStatus>('loading');

  useEffect(() => {
    let alive = true;
    let base: Signals | null = null;
    try {
      base = loaders.basic();
      setSignals(base);
    } catch {
      /* leave empty */
    }
    if (base) {
      loaders
        .extras(base)
        .then((s) => alive && setSignals(s))
        .catch(() => {})
        .finally(() => alive && setExtrasReady(true));
    }
    loaders
      .whoami()
      .then((w) => {
        if (!alive) return;
        setWho(w);
        setWhoStatus(w ? 'ok' : 'unavailable');
      })
      .catch(() => alive && setWhoStatus('unavailable'));
    return () => {
      alive = false;
    };
  }, [loaders]);

  const items = useMemo(() => (signals ? buildItems(signals, who) : []), [signals, who]);
  const value = useMemo(() => ({ signals, who, whoStatus, extrasReady, items }), [signals, who, whoStatus, extrasReady, items]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useDevice = () => useContext(Ctx);
