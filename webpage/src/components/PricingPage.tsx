import type { Text } from '../data/features';
import { FAQ, FAQ_TITLE, PACKS, PACK_TEXT, PAGE, PLANS } from '../data/pricing';
import { useI18n } from '../lib/i18n';
import { PLAY_URL, termsPath } from '../lib/site';
import { Icon } from './Icon';
import { Footer, Header } from './Sections';

/** The /<lang>/pricing/ page: static, no script (scripts/prerender.mjs; the content in src/data/pricing.ts). */
export function PricingPage() {
  const { t, lang } = useI18n();
  const L = (x: Text) => x[lang];
  const num = new Intl.NumberFormat(lang === 'tr' ? 'tr-TR' : 'en-US');
  const usd = new Intl.NumberFormat(lang === 'tr' ? 'tr-TR' : 'en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
  return (
    <>
      <Header page="pricing/" />
      <main id="main" className="pricing">
        <section className="section pricing-hero" aria-labelledby="pricing-title">
          <p className="eyebrow">{L(PAGE.kicker)}</p>
          <h1 id="pricing-title">{L(PAGE.title)}</h1>
          <p className="lede">{L(PAGE.lede)}</p>
        </section>

        <section className="section plans" aria-label={L(PAGE.kicker)}>
          {PLANS.map((p) => (
            <article key={p.id} id={p.id} className={`plan plan-${p.id}`} aria-labelledby={`${p.id}-name`}>
              <div className="plan-icon">
                <Icon name={p.id === 'own-key' ? 'key' : 'server'} size={22} />
              </div>
              <h2 id={`${p.id}-name`}>{L(p.name)}</h2>
              <p className="plan-price">{L(p.price)}</p>
              <p className="plan-sub">{L(p.sub)}</p>
              <ul>
                {p.points.map((pt) => (
                  <li key={pt.en}>
                    <Icon name="check" size={18} className="mark mark-yes" />
                    <span>{L(pt)}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>

        <section className="band dark" aria-labelledby="packs-title">
          <div className="section">
            <h2 id="packs-title">{L(PACK_TEXT.title)}</h2>
            <p className="lede">{L(PACK_TEXT.lede)}</p>
            <ul className="packs">
              {PACKS.map((p) => (
                <li key={p.credits} className={p.bonus ? 'pack bonus' : 'pack'}>
                  <p className="pack-credits">
                    <strong>{num.format(p.credits)}</strong> {L(PACK_TEXT.credits)}
                  </p>
                  <p className="pack-price">{usd.format(p.usd)}</p>
                  {p.bonus ? (
                    <p className="pack-bonus">{L(PACK_TEXT.bonus).replace('{n}', num.format(p.bonus))}</p>
                  ) : (
                    <p className="pack-bonus empty" aria-hidden="true">
                      &nbsp;
                    </p>
                  )}
                </li>
              ))}
            </ul>
            <p className="pack-note">{L(PACK_TEXT.note)}</p>
            <p className="pack-note">{L(PACK_TEXT.where)}</p>
            <p className="pack-cta">
              <a className="play-badge" href={PLAY_URL}>
                <img
                  src={`/img/google-play-${lang}.png`}
                  alt={t('hero.play')}
                  width={lang === 'tr' ? 646 : 564}
                  height={lang === 'tr' ? 192 : 168}
                />
              </a>
              <a className="button secondary" href={`/${lang}/#beta`}>
                {t('hero.beta')}
              </a>
            </p>
          </div>
        </section>

        <section className="section pricing-faq" aria-labelledby="faq-title">
          <h2 id="faq-title">{L(FAQ_TITLE)}</h2>
          <dl>
            {FAQ.map((f) => (
              <div key={f.q.en}>
                <dt>{L(f.q)}</dt>
                <dd>{L(f.a)}</dd>
              </div>
            ))}
          </dl>
          <p className="pricing-terms">
            <a href={termsPath(lang)}>{t('footer.terms')}</a>
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
