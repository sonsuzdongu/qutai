import { useState, useSyncExternalStore } from 'react';
import { CHECKED, COMPETITORS, DEFAULT_PICK, EXCLUDED, GROUPS, QUTAI, type Cell, type Product, type State } from '../data/comparison';
import type { MessageKey } from '../i18n/en';
import { formatDate, useI18n } from '../lib/i18n';
import { ISSUES_URL } from '../lib/site';
import { Icon } from './Icon';

const STATE_LABEL: Record<State, MessageKey> = {
  yes: 'compare.yes',
  partial: 'compare.partial',
  no: 'compare.no',
  unknown: 'compare.unknown',
};

function StateMark({ state }: { state: State }) {
  if (state === 'partial')
    return (
      <svg className="mark mark-partial" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 4a8 8 0 0 0 0 16z" fill="currentColor" />
      </svg>
    );
  const icon = state === 'yes' ? 'check' : state === 'no' ? 'no' : 'dash';
  return <Icon name={icon} size={18} className={`mark mark-${state}`} />;
}

/**
 * One cell: the state (or the price) first; its note and source sit in a <details> that opens on a tap, or for every
 * cell at once with "Show notes". Without JavaScript the <details> still opens on a tap.
 */
function CellView({
  cell,
  product,
  feature,
  isPrice,
  allOpen,
}: {
  cell: Cell;
  product: Product;
  feature: string;
  isPrice: boolean;
  allOpen: boolean;
}) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const label = isPrice && cell.value ? cell.value[lang] : t(STATE_LABEL[cell.state]);
  const state = (
    <span className={`state state-${cell.state}`}>
      {!(isPrice && cell.value) && <StateMark state={cell.state} />}
      <span className={cell.state === 'unknown' ? 'state-label muted' : 'state-label'}>{label}</span>
    </span>
  );
  const hasSource = !!cell.source && product.id !== 'qutai';
  if (!cell.note && !hasSource) return state;
  return (
    <details
      className="cell"
      open={allOpen || open}
      onToggle={(e) => {
        const now = (e.currentTarget as HTMLDetailsElement).open;
        if (!allOpen) setOpen(now);
      }}
    >
      <summary>
        {state}
        <Icon name="info" size={14} className="cell-more" />
      </summary>
      {cell.note && <span className="cell-note">{cell.note[lang]}</span>}
      {hasSource && (
        <a
          className="cell-source"
          href={cell.source}
          rel="noopener noreferrer nofollow"
          aria-label={t('compare.sourceFor', { name: product.name, feature })}
          title={cell.checked ? `${t('compare.source')} · ${formatDate(cell.checked, lang)}` : undefined}
        >
          {t('compare.source')}
          <Icon name="external" size={12} />
        </a>
      )}
    </details>
  );
}

const noSubscribe = () => () => {};
/** The picker's choice that shows every competitor. */
const ALL = 'all';

/** False in the prerendered HTML and during hydration, true once React runs in the browser. */
function useHydrated() {
  return useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
}

export function Comparison() {
  const { t, lang } = useI18n();
  // Qutai next to one competitor at a time (or all of them), states first and notes on a tap or with "Show notes".
  // Without JavaScript (or before hydration), every column is there and the table scrolls sideways with the feature
  // names pinned.
  const enhanced = useHydrated();
  const [pick, setPick] = useState<string>(DEFAULT_PICK);
  const [notes, setNotes] = useState(false);
  const all = pick === ALL;

  const off = (id: string) => (enhanced && !all && id !== QUTAI.id && id !== pick ? ' off' : '');
  const products = [QUTAI, ...COMPETITORS];
  const excluded = EXCLUDED.map((e) => `${e.name} (${e.reason[lang]})`).join('; ');

  return (
    <section id="compare" className="section compare" aria-labelledby="compare-title">
      <div className="section-head reveal">
        <p className="kicker">{t('compare.kicker')}</p>
        <h2 id="compare-title">{t('compare.title')}</h2>
        <p className="lede">{t('compare.lede')}</p>
        <p className="compare-meta">
          <span className="checked">{t('compare.checked', { date: formatDate(CHECKED, lang) })}</span>
          <a href="#methodology">{t('compare.methodologyLink')}</a>
          <a href={ISSUES_URL}>{t('compare.correction')}</a>
        </p>
      </div>

      <ul className="legend reveal" aria-label={t('compare.legend')}>
        {(['yes', 'partial', 'no', 'unknown'] as State[]).map((s) => (
          <li key={s} className={`state state-${s}`}>
            <StateMark state={s} />
            <span>{t(STATE_LABEL[s])}</span>
          </li>
        ))}
      </ul>

      {enhanced && (
        <fieldset className="picker">
          <legend>
            {t('compare.pickLabel')}
          </legend>
          <div className="chips">
            {COMPETITORS.map((c) => (
              <label key={c.id} className={pick === c.id ? 'chip on' : 'chip'}>
                <input type="radio" name="compare-with" checked={pick === c.id} onChange={() => setPick(c.id)} />
                {c.name}
              </label>
            ))}
            <label className={all ? 'chip on' : 'chip'}>
              <input type="radio" name="compare-with" checked={all} onChange={() => setPick(ALL)} />
              {t('compare.all')}
            </label>
          </div>
        </fieldset>
      )}
      {enhanced && (
        <div className="notes-bar">
          <p className="muted">{t('compare.tapHint')}</p>
          <button type="button" className="notes-toggle" aria-pressed={notes} onClick={() => setNotes((v) => !v)}>
            {t(notes ? 'compare.notesHide' : 'compare.notesShow')}
          </button>
        </div>
      )}

      <div className="table-scroll" tabIndex={0} role="region" aria-labelledby="compare-title">
        <table className={enhanced ? `cmp enhanced${all ? ' all' : ' pair'}${notes ? ' notes' : ''}` : 'cmp'}>
          <caption className="sr-only">{t('compare.caption')}</caption>
          <thead>
            <tr>
              <th scope="col" className="feature-col">
                {t('compare.feature')}
              </th>
              {products.map((p) => (
                <th key={p.id} scope="col" className={`prod prod-${p.id}${p.id === 'qutai' ? ' us' : ''}${off(p.id)}`}>
                  <span className="prod-name">{p.name}</span>
                  <span className="prod-platforms">{p.platforms[lang]}</span>
                </th>
              ))}
            </tr>
          </thead>
          {GROUPS.map((g) => (
            <tbody key={g.id}>
              <tr className="group-row">
                <th scope="colgroup" colSpan={products.length + 1}>
                  {g.label[lang]}
                </th>
              </tr>
              {g.rows.map((r) => (
                <tr key={r.id}>
                  <th scope="row" className="feature-col">
                    {r.label[lang]}
                  </th>
                  {products.map((p) => (
                    <td key={p.id} className={`${p.id === 'qutai' ? 'us' : ''}${off(p.id)}`}>
                      <CellView
                        cell={p.cells[r.id]}
                        product={p}
                        feature={r.label[lang]}
                        isPrice={r.id === 'price'}
                        allOpen={notes}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>

      <p className="footnote">{t('compare.excluded', { list: excluded })}</p>

      <aside id="methodology" className="methodology" aria-labelledby="methodology-title">
        <h3 id="methodology-title">{t('compare.methodology.title')}</h3>
        <p>{t('compare.methodology.1')}</p>
        <p>{t('compare.methodology.2')}</p>
        <p>{t('compare.methodology.3')}</p>
        <p>{t('compare.methodology.4')}</p>
        <p>
          <a href={ISSUES_URL}>{t('compare.correction')}</a>
        </p>
      </aside>
    </section>
  );
}
