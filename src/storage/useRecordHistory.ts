import { useEffect } from 'react';
import type { Browser } from '../browser/Browser';
import { getDb } from './db';
import { pruneHistory, recordVisit } from './history';

/** Writes finished page loads of normal tabs to history; incognito tabs never reach here. */
export function useRecordHistory(browser: Browser) {
  useEffect(() => {
    getDb()
      .then((db) => pruneHistory(db))
      .catch(() => {});
    return browser.onVisit((tab) => {
      getDb()
        .then((db) => recordVisit(db, tab.url, tab.title))
        .catch(() => {});
    });
  }, [browser]);
}
