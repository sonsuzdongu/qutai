import { CHECKED, COMPETITORS, GROUPS, QUTAI, type Cell, type Product } from '../data/comparison';
import type { Text } from '../data/features';
import { GUIDE, GUIDE_QA, VS } from '../data/guide';
import { formatDate, useI18n } from '../lib/i18n';
import { ISSUES_URL, PLAY_URL } from '../lib/site';
import { Icon } from './Icon';
import { STATE_LABEL, StateMark } from './Comparison';
import { Footer, Header } from './Sections';

const fill = (s: string, vars: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);

function Get() {
  const { t, lang } = useI18n();
  return (
    <p className="seo-cta">
      <a className="play-badge" href={PLAY_URL}>
        <img src={`/img/google-play-${lang}.png`} alt={t('hero.play')} width={lang === 'tr' ? 646 : 564} height={lang === 'tr' ? 192 : 168} />
      </a>
      <a className="button secondary" href={`/${lang}/#beta`}>
        {t('hero.beta')}
      </a>
      <a className="button secondary" href={`/${lang}/pricing/`}>
        {t('nav.pricing')}
      </a>
    </p>
  );
}

/** One product's cell on a comparison page: state (or price), note and, for competitors, the source. Always open. */
function CellText({ cell, product }: { cell: Cell; product: Product }) {
  const { t, lang } = useI18n();
  return (
    <div className="vs-cell">
      <p className="vs-product">{product.name}</p>
      <p className={`state state-${cell.state}`}>
        {cell.value ? null : <StateMark state={cell.state} />}
        <span className="state-label">{cell.value ? cell.value[lang] : t(STATE_LABEL[cell.state])}</span>
      </p>
      {cell.note && <p className="cell-note">{cell.note[lang]}</p>}
      {cell.source && product.id !== QUTAI.id && (
        <a className="cell-source" href={cell.source} rel="noopener noreferrer nofollow">
          {t('compare.source')}
          {cell.checked ? ` · ${formatDate(cell.checked, lang)}` : ''}
          <Icon name="external" size={12} />
        </a>
      )}
    </div>
  );
}

function OtherComparisons({ current }: { current?: string }) {
  const { lang } = useI18n();
  const L = (x: Text) => x[lang];
  return (
    <nav className="vs-others" aria-label={L(VS.others)}>
      <h2>{L(VS.others)}</h2>
      <ul>
        {COMPETITORS.filter((c) => c.id !== current).map((c) => (
          <li key={c.id}>
            <a href={`/${lang}/vs/${c.id}/`}>{fill(L(VS.title), { name: c.name })}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** /<lang>/vs/<id>/: Qutai next to one competitor, every row of the comparison table, notes and sources in view. */
export function VsPage({ id }: { id: string }) {
  const { lang } = useI18n();
  const L = (x: Text) => x[lang];
  const c = COMPETITORS.find((p) => p.id === id)!;
  const vars = { name: c.name, platforms: L(c.platforms), date: formatDate(CHECKED, lang) };
  const rows = GROUPS.flatMap((g) => g.rows);
  const differ = rows.filter((r) => r.id === 'price' || QUTAI.cells[r.id].state !== c.cells[r.id].state);
  const alike = rows.filter((r) => !differ.includes(r));
  return (
    <>
      <Header page={`vs/${id}/`} />
      <main id="main" className="seo">
        <section className="section seo-hero" aria-labelledby="vs-title">
          <p className="eyebrow">{L(VS.kicker)}</p>
          <h1 id="vs-title">{fill(L(VS.title), vars)}</h1>
          <p className="lede">{fill(L(VS.lede), vars)}</p>
        </section>
        <section className="section seo-body" aria-labelledby="differ-title">
          <h2 id="differ-title">{L(VS.differ)}</h2>
          {differ.map((r) => (
            <article key={r.id} className="vs-row">
              <h3>{L(r.label)}</h3>
              <div className="vs-pair">
                <CellText cell={QUTAI.cells[r.id]} product={QUTAI} />
                <CellText cell={c.cells[r.id]} product={c} />
              </div>
            </article>
          ))}
          {alike.length > 0 && (
            <>
              <h2>{L(VS.alike)}</h2>
              {alike.map((r) => (
                <article key={r.id} className="vs-row">
                  <h3>{L(r.label)}</h3>
                  <div className="vs-pair">
                    <CellText cell={QUTAI.cells[r.id]} product={QUTAI} />
                    <CellText cell={c.cells[r.id]} product={c} />
                  </div>
                </article>
              ))}
            </>
          )}
          <p className="vs-links">
            <a href={`/${lang}/#compare`}>{L(VS.full)}</a>
            <a href={`/${lang}/agentic-browser/`}>{L(VS.guide)}</a>
            <a href={ISSUES_URL}>{L(VS.correction)}</a>
          </p>
          <Get />
          <OtherComparisons current={id} />
        </section>
      </main>
      <Footer />
    </>
  );
}

/** /<lang>/agentic-browser/: short answers to what people ask about agentic and AI browsers on phones. */
export function GuidePage() {
  const { t, lang } = useI18n();
  const L = (x: Text) => x[lang];
  const products = [QUTAI, ...COMPETITORS];
  return (
    <>
      <Header page="agentic-browser/" />
      <main id="main" className="seo">
        <section className="section seo-hero" aria-labelledby="guide-title">
          <p className="eyebrow">{L(GUIDE.kicker)}</p>
          <h1 id="guide-title">{L(GUIDE.title)}</h1>
          <p className="lede">{L(GUIDE.lede)}</p>
        </section>
        <section className="section seo-body">
          {GUIDE_QA.map((qa) => (
            <article key={qa.id} id={qa.id} className="qa" aria-labelledby={`${qa.id}-q`}>
              <h2 id={`${qa.id}-q`}>{L(qa.q)}</h2>
              {qa.a.map((p) => (
                <p key={p.en}>{L(p)}</p>
              ))}
              {qa.id === 'cost' && (
                <p>
                  <a href={`/${lang}/pricing/`}>{t('nav.pricing')}</a>
                </p>
              )}
            </article>
          ))}
          <article id="which" className="qa" aria-labelledby="which-q">
            <h2 id="which-q">{L(GUIDE.whichQ)}</h2>
            <p>{fill(L(GUIDE.whichIntro), { date: formatDate(CHECKED, lang) })}</p>
            <ul className="which">
              {products.map((p) => (
                <li key={p.id}>
                  <span className={`state state-${p.cells.agent.state}`}>
                    <StateMark state={p.cells.agent.state} />
                    <strong>{p.name}</strong>
                    <span className="state-label">{t(STATE_LABEL[p.cells.agent.state])}</span>
                  </span>
                  {p.id !== QUTAI.id && (
                    <a href={`/${lang}/vs/${p.id}/`}>{fill(L(VS.title), { name: p.name })}</a>
                  )}
                </li>
              ))}
            </ul>
            <p>{L(GUIDE.whichOutro)}</p>
          </article>
          <h2 className="seo-cta-title">{L(GUIDE.cta)}</h2>
          <Get />
        </section>
      </main>
      <Footer />
    </>
  );
}

/** The guide's questions and answers as plain text, for its FAQPage structured data. */
export function guideFaq(lang: 'en' | 'tr') {
  return GUIDE_QA.map((qa) => ({ q: qa.q[lang], a: qa.a.map((p) => p[lang]).join(' ') }));
}
