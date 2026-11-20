import { useEffect } from 'react';
import type { Browser } from '../browser/Browser';
import { withDb } from './db';
import { pruneHistory, recordVisit } from './history';

/** Writes finished page loads of normal tabs to history; incognito tabs never reach here. */
export function useRecordHistory(browser: Browser) {
  useEffect(() => {
    void withDb('history.prune', pruneHistory);
    return browser.onVisit((tab) => {
      void withDb('history.record', (db) => recordVisit(db, tab.url, tab.title));
    });
  }, [browser]);
}
