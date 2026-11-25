import type { MessageKey } from '../i18n/en';
import { useI18n } from '../lib/i18n';
import { ISSUES_URL, LICENSE_URL, PLAY_URL, REPO_URL, TESTFLIGHT_URL, deleteAccountPath, privacyPolicyPath, supportPath, termsPath } from '../lib/site';
import { Icon, type IconName } from './Icon';
import { Miniature, type ArtName } from './Miniature';
import { PhoneMock } from './PhoneMock';

const LANG_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Remembers the visitor's choice so `/` sends them here next time (the only cookie the site sets). */
function rememberLanguage(lang: string) {
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `lang=${lang}; Path=/; Max-Age=${LANG_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

/** `page` is the path after the language for pages other than home (`features/`): section links then go home. */
export function Header({ page }: { page?: string } = {}) {
  const { t, lang } = useI18n();
  const other = lang === 'en' ? 'tr' : 'en';
  const home = page ? `/${lang}/` : '';
  return (
    <header className="site-header">
      <a className="skip" href="#main">
        {t('nav.skip')}
      </a>
      <div className="header-inner">
        <a className="brand" href={`/${lang}/`} aria-label={t('nav.home')}>
          <img src="/img/q-64.webp" width="32" height="32" alt="" />
          <span>Qutai</span>
        </a>
        <nav aria-label={t('nav.label')} className="main-nav">
          <a href={`${home}#agent`}>{t('nav.agent')}</a>
          <a href={`/${lang}/features/`} aria-current={page === 'features/' ? 'page' : undefined}>
            {t('nav.features')}
          </a>
          <a href={`/${lang}/pricing/`} aria-current={page === 'pricing/' ? 'page' : undefined}>
            {t('nav.pricing')}
          </a>
          <a href={`${home}#privacy`}>{t('nav.privacy')}</a>
          <a href={`${home}#compare`}>{t('nav.compare')}</a>
          <a href={`${home}#open-source`}>{t('nav.openSource')}</a>
          <a href={`${home}#status`}>{t('nav.status')}</a>
        </nav>
        <div className="header-actions">
          <a
            className="lang-switch"
            href={`/${other}/${page ?? ''}`}
            hrefLang={other}
            lang={other}
            aria-label={t('lang.switchTo')}
            onClick={() => rememberLanguage(other)}
          >
            <Icon name="globe" size={18} />
            <span className="lang-long">{t('lang.other')}</span>
            <span className="lang-short">{t('lang.otherShort')}</span>
          </a>
          <a className="header-github" href={REPO_URL} aria-label={t('nav.github')}>
            <Icon name="github" size={20} />
          </a>
        </div>
      </div>
    </header>
  );
}

export function Hero() {
  const { t, lang } = useI18n();
  const points: { key: MessageKey; icon: IconName }[] = [
    { key: 'hero.chip1', icon: 'bookmark' },
    { key: 'hero.chip2', icon: 'list' },
    { key: 'hero.chip3', icon: 'research' },
    { key: 'hero.chip4', icon: 'hand' },
  ];
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-copy">
        <p className="eyebrow">{t('hero.eyebrow')}</p>
        <h1 id="hero-title">{t('hero.title')}</h1>
        <p className="tagline">{t('hero.tagline')}</p>
        <p className="lede">{t('hero.lede')}</p>
        <div className="hero-actions">
          <a className="play-badge" href={PLAY_URL}>
            <img src={`/img/google-play-${lang}.png`} alt={t('hero.play')} width={lang === 'tr' ? 646 : 564} height={lang === 'tr' ? 192 : 168} />
          </a>
          <a className="button primary" href="#beta">
            <Icon name="phone" size={20} />
            {t('hero.beta')}
          </a>
          <a className="button secondary" href={REPO_URL}>
            <Icon name="github" size={20} />
            {t('hero.github')}
          </a>
          <p className="status-pill">
            <span className="dot" aria-hidden="true" />
            {t('hero.status')}
          </p>
        </div>
      </div>
      <div className="hero-art">
        <div className="hero-art-frame">
          <Miniature name="hero" ratio="3x2" sizes="(min-width: 1200px) 1100px, 100vw" priority />
        </div>
        {/* A gilded band under the painting with the four points. */}
        <div className="hero-plaque">
          <ul className="hero-points">
            {points.map((c) => (
              <li key={c.key}>
                <Icon name={c.icon} size={16} />
                {t(c.key)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/** One long sentence about Qutai that fills in as it scrolls by, next to the app as it really looks. */
export function Statement() {
  const { t } = useI18n();
  return (
    <section className="band dark statement" aria-labelledby="statement-title">
      <div className="statement-inner">
        <div>
          <p className="kicker" id="statement-title">
            {t('statement.kicker')}
          </p>
          <p className="statement-text">
            {t('statement.text')
              .split(' ')
              .map((word, i) => (
                <span key={i} className="w">
                  {word}{' '}
                </span>
              ))}
          </p>
        </div>
        <div className="statement-phone" data-depth="-0.08">
          <PhoneMock />
        </div>
      </div>
    </section>
  );
}

function SectionHead({ kicker, title, lede, id }: { kicker: MessageKey; title: MessageKey; lede?: MessageKey; id: string }) {
  const { t } = useI18n();
  return (
    <div className="section-head reveal">
      <p className="kicker">{t(kicker)}</p>
      <h2 id={id}>{t(title)}</h2>
      {lede && <p className="lede">{t(lede)}</p>}
    </div>
  );
}

type Step = { icon: IconName; text: MessageKey; tone?: 'ask' | 'stop' };

function Trail({ steps }: { steps: Step[] }) {
  const { t } = useI18n();
  return (
    <ol className="trail">
      {steps.map((s) => (
        <li key={s.text} className={s.tone ? `trail-${s.tone}` : undefined}>
          <Icon name={s.icon} size={16} />
          <span>{t(s.text)}</span>
        </li>
      ))}
    </ol>
  );
}

type Scenario = {
  id: 'forms' | 'checkout' | 'booking' | 'research';
  art: ArtName;
  steps: Step[];
  call?: boolean;
};

const SCENARIOS: Scenario[] = [
  {
    id: 'forms',
    art: 'checkout',
    steps: [
      { icon: 'hand', text: 'agent.forms.step1', tone: 'ask' },
      { icon: 'code', text: 'agent.forms.step2' },
    ],
  },
  {
    id: 'checkout',
    art: 'compare',
    steps: [
      { icon: 'list', text: 'agent.checkout.step1' },
      { icon: 'cart', text: 'agent.checkout.step2' },
      { icon: 'cart', text: 'agent.checkout.step3', tone: 'ask' },
    ],
  },
  { id: 'booking', art: 'booking', steps: [{ icon: 'calendar', text: 'agent.booking.step1', tone: 'ask' }], call: true },
  {
    id: 'research',
    art: 'research',
    steps: [
      { icon: 'research', text: 'agent.research.step1' },
      { icon: 'reader', text: 'agent.research.step2' },
      { icon: 'list', text: 'agent.research.step3' },
    ],
  },
];

export function Agent() {
  const { t } = useI18n();
  return (
    <section id="agent" className="section agent" aria-labelledby="agent-title">
      <SectionHead id="agent-title" kicker="agent.kicker" title="agent.title" lede="agent.lede" />
      <div className="scenarios">
        {SCENARIOS.map((sc) => (
          <article key={sc.id} className="scenario" aria-labelledby={`sc-${sc.id}`}>
            <div className="scenario-art reveal">
              <div data-depth="0.05">
                <Miniature name={sc.art} />
              </div>
            </div>
            <div className="scenario-copy reveal">
              <p className="kicker">{t(`agent.${sc.id}.kicker`)}</p>
              <h3 id={`sc-${sc.id}`}>{t(`agent.${sc.id}.title`)}</h3>
              <p>{t(`agent.${sc.id}.body`)}</p>
              <Trail steps={sc.steps} />
              {sc.call && (
                <div className="call-card" aria-hidden="true">
                  <div>
                    <p className="call-name">{t('agent.booking.callName')}</p>
                    <p className="call-number">{t('agent.booking.callNumber')}</p>
                  </div>
                  <span className="call-button">
                    <Icon name="call" size={16} />
                    {t('agent.booking.call')}
                  </span>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
      <p className="footnote reveal">{t('agent.footnote')}</p>
    </section>
  );
}

export function Memory() {
  const { t } = useI18n();
  return (
    <section className="band alt memory-band" aria-labelledby="memory-title">
      <div className="memory">
        <div className="memory-art reveal">
          <Miniature name="memory" />
        </div>
        <div className="reveal">
          <p className="kicker">{t('agent.memory.kicker')}</p>
          <h2 id="memory-title">{t('agent.memory.title')}</h2>
          <p className="memory-body">{t('agent.memory.body')}</p>
          <ul>
            {(['agent.memory.point1', 'agent.memory.point2', 'agent.memory.point3', 'agent.memory.point4'] as const).map((k, i) => (
              <li key={k}>
                <Icon name={(['list', 'phone', 'globe', 'key'] as const)[i]} size={20} />
                <span>{t(k)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

const PRIVACY: { icon: IconName; key: 'key' | 'device' | 'sites' | 'log' | 'incognito' | 'confirm' | 'contacts' | 'scripts' | 'apps' }[] = [
  { icon: 'key', key: 'key' },
  { icon: 'phone', key: 'device' },
  { icon: 'sliders', key: 'sites' },
  { icon: 'list', key: 'log' },
  { icon: 'incognito', key: 'incognito' },
  { icon: 'hand', key: 'confirm' },
  { icon: 'call', key: 'contacts' },
  { icon: 'code', key: 'scripts' },
  { icon: 'apps', key: 'apps' },
];

function Node({ icon, title, sub, dashed }: { icon: IconName; title: MessageKey; sub: MessageKey; dashed?: boolean }) {
  const { t } = useI18n();
  return (
    <div className={dashed ? 'dp-node dashed' : 'dp-node'}>
      <Icon name={icon} size={26} />
      <strong>{t(title)}</strong>
      <span>{t(sub)}</span>
    </div>
  );
}

/**
 * The two ways to the AI: Qutai Credits through Qutai's server (official builds; listed first, as in the app, AI-35),
 * and the user's own key straight to the provider (every build, the only way in builds from the repository).
 */
function DataPath() {
  const { t } = useI18n();
  return (
    <figure className="datapath reveal" role="img" aria-label={t('privacy.diagramLabel')}>
      <div className="dp-lane">
        <p className="dp-lane-head">
          <strong>{t('privacy.routeService')}</strong>
          <span className="dp-tag now">{t('privacy.routeServiceTag')}</span>
        </p>
        <div className="dp-route">
          <Node icon="phone" title="privacy.diagramPhone" sub="privacy.diagramPhoneSub" />
          <span className="dp-arrow" />
          <Node icon="server" title="privacy.diagramQutai" sub="privacy.diagramQutaiSub" />
          <span className="dp-arrow" />
          <Node icon="globe" title="privacy.diagramAi" sub="privacy.diagramAiSub" />
        </div>
      </div>
      <div className="dp-lane">
        <p className="dp-lane-head">
          <strong>{t('privacy.routeOwn')}</strong>
          <span className="dp-tag now">{t('privacy.routeOwnTag')}</span>
        </p>
        <div className="dp-route">
          <Node icon="phone" title="privacy.diagramPhone" sub="privacy.diagramPhoneSub" />
          <span className="dp-arrow" />
          <span className="dp-none">
            <Icon name="server" size={16} />
            <span>{t('privacy.diagramNone')}</span>
          </span>
          <span className="dp-arrow" />
          <Node icon="key" title="privacy.diagramProvider" sub="privacy.diagramProviderSub" />
        </div>
      </div>
    </figure>
  );
}

export function Privacy() {
  const { t } = useI18n();
  return (
    <section id="privacy" className="band dark privacy" aria-labelledby="privacy-title">
      <div className="section">
      <SectionHead id="privacy-title" kicker="privacy.kicker" title="privacy.title" lede="privacy.lede" />
      <DataPath />
      <ul className="privacy-grid">
        {PRIVACY.map(({ icon, key }) => (
          <li key={key} className="reveal">
            <Icon name={icon} size={26} />
            <h3>{t(`privacy.${key}.title`)}</h3>
            <p>{t(`privacy.${key}.body`)}</p>
          </li>
        ))}
      </ul>
      <p className="footnote reveal">{t('privacy.note')}</p>
      </div>
    </section>
  );
}

const BROWSER: { icon: IconName; key: 'tabs' | 'reader' | 'blocking' | 'audio' | 'private' | 'backup' | 'bookmarks' | 'voice' | 'save' | 'styles' | 'cookies' | 'images' | 'desktop' }[] = [
  { icon: 'tabs', key: 'tabs' },
  { icon: 'reader', key: 'reader' },
  { icon: 'shield', key: 'blocking' },
  { icon: 'audio', key: 'audio' },
  { icon: 'incognito', key: 'private' },
  { icon: 'backup', key: 'backup' },
  { icon: 'bookmark', key: 'bookmarks' },
  { icon: 'mic', key: 'voice' },
  { icon: 'pdf', key: 'save' },
  { icon: 'palette', key: 'styles' },
  { icon: 'cookie', key: 'cookies' },
  { icon: 'image', key: 'images' },
  { icon: 'desktop', key: 'desktop' },
];

export function BrowserFeatures() {
  const { t, lang } = useI18n();
  return (
    <section id="browser" className="section browser" aria-labelledby="browser-title">
      <SectionHead id="browser-title" kicker="browser.kicker" title="browser.title" />
      <ul className="browser-list">
        {BROWSER.map(({ icon, key }) => (
          <li key={key} className="reveal">
            <Icon name={icon} size={22} />
            <div>
              <h3>{t(`browser.${key}.title`)}</h3>
              <p>{t(`browser.${key}.body`)}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="features-more">
        <a className="button secondary" href={`/${lang}/features/`}>
          {t('browser.more')}
          <Icon name="arrow" size={18} />
        </a>
      </p>
    </section>
  );
}

export function GetStarted() {
  const { t } = useI18n();
  const steps: { n: 1 | 2 | 3; icon: IconName }[] = [
    { n: 1, icon: 'phone' },
    { n: 2, icon: 'key' },
    { n: 3, icon: 'hand' },
  ];
  return (
    <section className="band dark start" aria-labelledby="start-title">
      <div className="section">
        <SectionHead id="start-title" kicker="start.kicker" title="start.title" />
        <ol className="start-steps">
          {steps.map(({ n, icon }) => (
            <li key={n} className="reveal">
              <span className="start-num" aria-hidden="true">
                0{n}
              </span>
              <Icon name={icon} size={22} />
              <h3>{t(`start.step${n}.title`)}</h3>
              <p>{t(`start.step${n}.body`)}</p>
            </li>
          ))}
        </ol>
        <div id="beta" className="beta reveal">
          <h3>{t('beta.title')}</h3>
          <p>{t('beta.lede')}</p>
          <ol>
            <li>{t('beta.step1')}</li>
            <li>{t('beta.step2')}</li>
            <li>{t('beta.step3')}</li>
          </ol>
          <p className="beta-actions">
            <a className="button primary" href={TESTFLIGHT_URL}>
              {t('beta.link')}
              <Icon name="external" size={18} />
            </a>
          </p>
          <p className="beta-note">{t('beta.note')}</p>
        </div>
      </div>
    </section>
  );
}

export function OpenSource() {
  const { t } = useI18n();
  return (
    <section id="open-source" className="section oss" aria-labelledby="oss-title">
      <div className="oss-grid">
        <div>
          <SectionHead id="oss-title" kicker="oss.kicker" title="oss.title" />
          <p className="reveal">{t('oss.body')}</p>
          <ul className="link-row reveal">
            <li>
              <a href={REPO_URL}>
                <Icon name="github" size={18} />
                {t('oss.repo')}
              </a>
            </li>
            <li>
              <a href={LICENSE_URL}>{t('oss.license')}: Apache-2.0</a>
            </li>
          </ul>
        </div>
        <div className="terminal reveal">
          <p className="terminal-label" id="build-label">
            {t('oss.buildLabel')}
          </p>
          <pre aria-labelledby="build-label" tabIndex={0}>
            <code>
              {`git clone ${REPO_URL}.git
cd qutai
npm install
cp .env.example .env
npx expo run:android   # or run:ios`}
            </code>
          </pre>
        </div>
      </div>
    </section>
  );
}

export function Status() {
  const { t } = useI18n();
  const list = (prefix: 'status.today' | 'status.limits' | 'status.planned', n: number) => (
    <ul>
      {Array.from({ length: n }, (_, i) => (
        <li key={i}>{t(`${prefix}.${i + 1}` as MessageKey)}</li>
      ))}
    </ul>
  );
  return (
    <section id="status" className="section status" aria-labelledby="status-title">
      <SectionHead id="status-title" kicker="status.kicker" title="status.title" lede="status.body" />
      <div className="status-grid">
        <div className="status-col today reveal">
          <h3>
            <Icon name="check" size={20} />
            {t('status.today')}
          </h3>
          {list('status.today', 9)}
        </div>
        <div className="status-col limits reveal">
          <h3>
            <Icon name="hand" size={20} />
            {t('status.limits')}
          </h3>
          {list('status.limits', 7)}
        </div>
        <div className="status-col planned reveal">
          <h3>
            <Icon name="arrow" size={20} />
            {t('status.planned')}
          </h3>
          {list('status.planned', 5)}
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  const { t, lang } = useI18n();
  const other = lang === 'en' ? 'tr' : 'en';
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <img src="/img/q-64.webp" width="28" height="28" alt="" />
          <p>
            <strong>Qutai</strong>: {t('footer.tagline')}
          </p>
        </div>
        <ul className="footer-links">
          <li>
            <a href={REPO_URL}>{t('footer.github')}</a>
          </li>
          <li>
            <a href={ISSUES_URL}>{t('footer.issues')}</a>
          </li>
          <li>
            <a href={LICENSE_URL}>{t('footer.license')}</a>
          </li>
          <li>
            <a href={`/${lang}/features/`}>{t('nav.features')}</a>
          </li>
          <li>
            <a href={`/${lang}/pricing/`}>{t('nav.pricing')}</a>
          </li>
          <li>
            <a href={`/${lang}/agentic-browser/`}>{t('footer.guide')}</a>
          </li>
          <li>
            <a href={privacyPolicyPath(lang)}>{t('footer.appPrivacy')}</a>
          </li>
          <li>
            <a href={termsPath(lang)}>{t('footer.terms')}</a>
          </li>
          <li>
            <a href={deleteAccountPath(lang)}>{t('footer.deleteAccount')}</a>
          </li>
          <li>
            <a href={supportPath(lang)}>{t('footer.support')}</a>
          </li>
          <li>
            <a href={`/${other}/`} hrefLang={other} lang={other} onClick={() => rememberLanguage(other)}>
              {t('lang.other')}
            </a>
          </li>
        </ul>
        <p className="footer-note">{t('footer.privacy')}</p>
        <p className="footer-note">{t('footer.licenseNote')}</p>
        <p className="footer-note">{t('footer.trademarks')}</p>
      </div>
    </footer>
  );
}
