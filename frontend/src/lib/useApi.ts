'use client';

import { useCallback, useEffect, useState } from 'react';

export type ApiState<T> = {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  reload: () => void;
  // Goes up by one for every answer that arrives: use it as a React key to restart an edit form from fresh data.
  version: number;
};

type Result<T> = { key?: string; data?: T; error?: unknown; version: number };

// Loads data whenever `deps` change. State changes only when an answer arrives (no setState in the effect body):
// "loading" simply means the answer on screen belongs to older deps. The last data stays visible while reloading,
// and answers that arrive late are ignored. `load` must only depend on values listed in `deps`.
export function useApi<T>(load: () => Promise<T>, deps: unknown[], enabled = true): ApiState<T> {
  const [tick, setTick] = useState(0);
  const [result, setResult] = useState<Result<T>>({ version: 0 });
  const key = JSON.stringify([...deps, tick]);

  useEffect(() => {
    if (!enabled) return;
    let current = true;
    load().then(
      (data) => { if (current) setResult((r) => ({ key, data, error: undefined, version: r.version + 1 })); },
      (error) => { if (current) setResult((r) => ({ ...r, key, error })); },
    );
    return () => { current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  const fresh = result.key === key;
  return {
    data: result.data,
    error: fresh ? result.error : undefined,
    loading: enabled && !fresh,
    reload,
    version: result.version,
  };
}

// A page number that falls back to 1 whenever the filters it belongs to change.
export function usePage(filtersKey: string): [number, (next: number | ((p: number) => number)) => void] {
  const [state, setState] = useState({ key: filtersKey, page: 1 });
  const page = state.key === filtersKey ? state.page : 1;
  const setPage = useCallback(
    (next: number | ((p: number) => number)) =>
      setState((s) => {
        const currentPage = s.key === filtersKey ? s.page : 1;
        return { key: filtersKey, page: typeof next === 'function' ? next(currentPage) : next };
      }),
    [filtersKey],
  );
  return [page, setPage];
}
