import { FEATURES_CHECKED, GROUPS, LEAVES, NEVER, NOT_BUILT, PAGE, PRINCIPLES, type Group, type Text } from '../data/features';
import { formatDate, useI18n } from '../lib/i18n';
import { Icon, PATHS } from './Icon';
import { Footer, Header } from './Sections';

const C = 300; // centre of the medallion's 600×600 drawing
const PETAL = 'M0,-112 C44,-132 62,-190 0,-262 C-62,-190 -44,-132 0,-112 Z';
const INNER = 'M0,-128 C30,-146 42,-190 0,-242 C-42,-190 -30,-146 0,-128 Z';
const FILLS = ['#1b6e87', '#0f3f50', '#b8432f', '#2287a5', '#8a5a1c'];
const polar = (r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [C + r * Math.cos(a), C + r * Math.sin(a)] as const;
};
const fix = (n: number) => Number(n.toFixed(2));

/**
 * An illuminated medallion (şemse) drawn for this page: Qutai's mark in the centre, one petal per group of features,
 * each a link to its group. Presentation attributes only: the site's CSP allows no inline styles.
 */
function Medallion({ label }: { label: string }) {
  const { lang } = useI18n();
  const step = 360 / GROUPS.length;
  return (
    <figure className="medallion">
      <svg viewBox="0 0 600 600" role="group" aria-label={label}>
        <defs>
          <radialGradient id="m-paper" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#fbf5e6" />
            <stop offset="1" stopColor="#ecdcb6" />
          </radialGradient>
          <linearGradient id="m-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#d9b25a" />
            <stop offset="0.5" stopColor="#a87a2a" />
            <stop offset="1" stopColor="#e3c27a" />
          </linearGradient>
        </defs>
        <circle cx={C} cy={C} r={296} fill="url(#m-paper)" stroke="url(#m-gold)" strokeWidth={4} />
        <circle cx={C} cy={C} r={284} fill="none" stroke="#a87a2a" strokeWidth={1} />
        {/* the scalloped border: small gold arcs and dots between the two rings */}
        {Array.from({ length: 40 }, (_, i) => {
          const [x, y] = polar(278, i * 9);
          return <circle key={`s${i}`} cx={fix(x)} cy={fix(y)} r={i % 2 ? 2.2 : 4.2} fill={i % 2 ? '#1b6e87' : 'url(#m-gold)'} />;
        })}
        <circle cx={C} cy={C} r={270} fill="none" stroke="#a87a2a" strokeWidth={0.8} strokeDasharray="2 5" />
        {/* leaves between the petals */}
        {GROUPS.map((_, i) => (
          <g key={`l${i}`} transform={`translate(${C} ${C}) rotate(${i * step + step / 2})`}>
            <path d="M0,-150 C14,-178 14,-212 0,-236 C-14,-212 -14,-178 0,-150 Z" fill="#2287a5" opacity={0.28} />
            <circle cx={0} cy={-252} r={5} fill="url(#m-gold)" />
            <circle cx={0} cy={-140} r={2.5} fill="#a87a2a" />
          </g>
        ))}
        {GROUPS.map((g, i) => {
          const [x, y] = polar(196, i * step);
          return (
            <a key={g.id} href={`#${g.id}`} className="petal" aria-label={g.title[lang]}>
              <title>{g.title[lang]}</title>
              <g transform={`translate(${C} ${C}) rotate(${i * step})`}>
                <path className="petal-fill" d={PETAL} fill={FILLS[i % FILLS.length]} stroke="url(#m-gold)" strokeWidth={3} />
                <path d={INNER} fill="none" stroke="#e3c27a" strokeWidth={1} opacity={0.75} />
              </g>
              <g transform={`translate(${fix(x - 18)} ${fix(y - 18)}) scale(1.5)`}>
                <path
                  d={PATHS[g.icon]}
                  fill="none"
                  stroke="#fbf5e6"
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            </a>
          );
        })}
        <circle cx={C} cy={C} r={104} fill="#fbf5e6" stroke="url(#m-gold)" strokeWidth={5} />
        <circle cx={C} cy={C} r={92} fill="none" stroke="#1b6e87" strokeWidth={1.2} />
        {Array.from({ length: 24 }, (_, i) => {
          const [x, y] = polar(98, i * 15);
          return <circle key={`c${i}`} cx={fix(x)} cy={fix(y)} r={1.6} fill="#a87a2a" />;
        })}
        <image href="/img/q-640.webp" x={C - 70} y={C - 70} width={140} height={140} />
      </svg>
    </figure>
  );
}

function GroupSection({ group, n }: { group: Group; n: number }) {
  const { lang } = useI18n();
  const L = (x: Text) => x[lang];
  return (
    <section id={group.id} className="fgroup" aria-labelledby={`${group.id}-title`}>
      <header className="fgroup-head">
        <span className="fgroup-mark" aria-hidden="true">
          <Icon name={group.icon} size={26} />
        </span>
        <div>
          <p className="kicker">{String(n).padStart(2, '0')}</p>
          <h2 id={`${group.id}-title`}>{L(group.title)}</h2>
          <p className="lede">{L(group.lede)}</p>
        </div>
      </header>
      <ul className="fcards">
        {group.items.map((f) => (
          <li key={f.title.en} className="fcard">
            <h3>{L(f.title)}</h3>
            <p>{L(f.body)}</p>
            {f.asks?.length ? (
              <div className="asks">
                <p className="asks-label">{L(PAGE.try)}</p>
                <ul>
                  {f.asks.map((a) => (
                    <li key={a.en}>
                      <q>{L(a)}</q>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function FeaturesPage() {
  const { lang } = useI18n();
  const L = (x: Text) => x[lang];
  return (
    <>
      <Header page="features/" />
      <main id="main" className="features">
        <section className="features-hero section" aria-labelledby="features-title">
          <div className="features-hero-copy">
            <p className="eyebrow">{L(PAGE.kicker)}</p>
            <h1 id="features-title">{L(PAGE.title)}</h1>
            <p className="lede">{L(PAGE.lede)}</p>
            <nav aria-label={L(PAGE.contents)} className="features-toc">
              <ol>
                {GROUPS.map((g) => (
                  <li key={g.id}>
                    <a href={`#${g.id}`}>
                      <Icon name={g.icon} size={18} />
                      {L(g.title)}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </div>
          <Medallion label={L(PAGE.medallionLabel)} />
        </section>

        <section className="band dark" aria-labelledby="principles-title">
          <div className="section">
            <h2 id="principles-title" className="features-h2">
              {L(PAGE.principlesTitle)}
            </h2>
            <ul className="principles">
              {PRINCIPLES.map((p) => (
                <li key={p.title.en}>
                  <Icon name={p.icon} size={24} />
                  <h3>{L(p.title)}</h3>
                  <p>{L(p.body)}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <div className="section fgroups">
          {GROUPS.map((g, i) => (
            <GroupSection key={g.id} group={g} n={i + 1} />
          ))}
        </div>

        <section className="band dark" aria-labelledby="leaves-title">
          <div className="section">
            <h2 id="leaves-title" className="features-h2">
              {L(PAGE.leavesTitle)}
            </h2>
            <div className="leaves-wrap">
              <table className="leaves">
                <thead>
                  <tr>
                    <th scope="col">{L(PAGE.leavesTo)}</th>
                    <th scope="col">{L(PAGE.leavesWhat)}</th>
                    <th scope="col">{L(PAGE.leavesWhen)}</th>
                  </tr>
                </thead>
                <tbody>
                  {LEAVES.map((r) => (
                    <tr key={r.to.en}>
                      <th scope="row">{L(r.to)}</th>
                      <td>{L(r.what)}</td>
                      <td>{L(r.when)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="never">
              <strong>{L(PAGE.neverTitle)}:</strong> {L(NEVER)}
            </p>
          </div>
        </section>

        <section className="section" aria-labelledby="notbuilt-title">
          <h2 id="notbuilt-title" className="features-h2">
            {L(PAGE.notBuiltTitle)}
          </h2>
          <p className="lede">{L(PAGE.notBuiltLede)}</p>
          <ul className="notbuilt">
            {NOT_BUILT.map((x) => (
              <li key={x.en}>
                <Icon name="dash" size={18} />
                <span>{L(x)}</span>
              </li>
            ))}
          </ul>
          <p className="footnote">{L(PAGE.status)}</p>
          <p className="footnote">
            {L(PAGE.checked)} <time dateTime={FEATURES_CHECKED}>{formatDate(FEATURES_CHECKED, lang)}</time>.{' '}
            <a href={`/${lang}/`}>{L(PAGE.home)}</a> · <a href="#main">{L(PAGE.top)}</a>
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
