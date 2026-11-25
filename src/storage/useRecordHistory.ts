import { useEffect } from 'react';
import type { Browser } from '../browser/Browser';
import { withDb } from './db';
import { onHistoryRemoved, pruneHistory, recordVisit } from './history';
import { pruneSiteIcons, refreshSiteIcon } from './siteIcons';

/**
 * Writes finished page loads of normal tabs to history and keeps their sites' icons (UI-72); incognito tabs never
 * reach here. Deleting visits deletes the icons of sites with no visit left.
 */
export function useRecordHistory(browser: Browser) {
  useEffect(() => {
    void withDb('history.prune', async (db) => {
      await pruneHistory(db);
      await pruneSiteIcons(db);
    });
    const stopRemoved = onHistoryRemoved(() => void withDb('siteIcons.prune', pruneSiteIcons));
    const stopVisits = browser.onVisit((tab) => {
      void withDb('history.record', (db) => recordVisit(db, tab.url, tab.title));
      void refreshSiteIcon(tab);
    });
    return () => {
      stopRemoved();
      stopVisits();
    };
  }, [browser]);
}
