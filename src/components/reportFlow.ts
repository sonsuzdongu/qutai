import { accountErrorMessage } from '../account';
import { appStore } from '../apps/appStore';
import { t } from '../i18n';
import { REPORT_CONTENT_MAX, REPORT_NOTE_MAX, REPORT_REASONS, cut, sendReport, type Report, type ReportKind } from '../report/report';
import { dialog } from './Dialog';

/**
 * ⋮ › Report on an assistant answer or an app (design record SAFE-2, SAFE-3): one dialog with the reasons and an
 * "Include the text" box (on: the user reports something, and the text is what is reported; it says plainly that the
 * text goes to Qutai), a note only for "Other", then the result in a dialog. Nothing is sent until "Send".
 */

const REASON_KEYS = {
  offensive: 'report.reason.offensive',
  sexual: 'report.reason.sexual',
  dangerous: 'report.reason.dangerous',
  misleading: 'report.reason.misleading',
  other: 'report.reason.other',
} as const;

type Target = {
  kind: ReportKind;
  /** The text that would be included: an answer, or an app's name and code. */
  text: () => Promise<string>;
  provider?: Report['provider'];
  appName?: string;
};

async function report(target: Target): Promise<void> {
  const answer = await dialog.show({
    title: t(target.kind === 'app' ? 'report.titleApp' : 'report.titleAnswer'),
    message: t(target.kind === 'app' ? 'report.messageApp' : 'report.messageAnswer'),
    choices: { label: t('report.reasonLabel'), options: REPORT_REASONS.map((r) => t(REASON_KEYS[r])), initial: 0 },
    checkbox: { label: t(target.kind === 'app' ? 'report.includeApp' : 'report.includeAnswer'), initial: true },
    buttons: [{ text: t('common.cancel'), style: 'cancel' }, { text: t('report.send'), primary: true }],
  });
  if (answer.button !== 1) return;
  const reason = REPORT_REASONS[answer.choice] ?? 'other';
  let note: string | null = null;
  if (reason === 'other') {
    note = await dialog.prompt({
      title: t('report.noteTitle'),
      label: t('report.noteLabel'),
      maxLength: REPORT_NOTE_MAX,
      confirmText: t('report.send'),
    });
    if (!note) return;
  }
  try {
    const content = answer.checked ? cut(await target.text(), REPORT_CONTENT_MAX) : null;
    await sendReport({ kind: target.kind, reason, note, content, provider: target.provider ?? null, appName: target.appName ?? null });
    dialog.alert(t('report.sentTitle'), t('report.sentMessage'));
  } catch (error) {
    dialog.alert(t('report.failedTitle'), accountErrorMessage(error));
  }
}

/** Reports an assistant answer. */
export function reportAnswer(text: string, provider: Report['provider']): Promise<void> {
  return report({ kind: 'answer', text: async () => text, provider });
}

/** Reports an app: the included text is its name and its files, as stored on this phone (never its data). */
export function reportApp(app: { id: string; name: string }): Promise<void> {
  return report({
    kind: 'app',
    appName: app.name,
    text: async () => {
      const loaded = await appStore.load(app.id);
      if (!loaded) return app.name;
      const files = Object.entries(loaded.pkg.files).map(([name, body]) => `--- ${name} ---\n${body}`);
      return [`${loaded.name}`, ...files].join('\n\n');
    },
  });
}
