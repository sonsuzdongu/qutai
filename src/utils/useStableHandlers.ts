import { useLayoutEffect, useRef, useState } from 'react';

type Handlers = Record<string, ((...args: never[]) => unknown) | undefined>;

/**
 * Functions that keep their identity across renders and always call the latest version passed in: a memoised child
 * (the chat panel) gets the same props while the app redraws for something else, yet a tap still runs today's code.
 * The set of names is fixed by the first render; a handler passed as undefined is called as a no-op.
 */
export function useStableHandlers<T extends Handlers>(handlers: T): T {
  const latest = useRef(handlers);
  useLayoutEffect(() => {
    latest.current = handlers;
  });
  const [stable] = useState(() => {
    const out: Record<string, (...args: never[]) => unknown> = {};
    for (const name of Object.keys(handlers)) {
      out[name] = (...args: never[]) => latest.current[name]?.(...args);
    }
    return out as T;
  });
  return stable;
}
