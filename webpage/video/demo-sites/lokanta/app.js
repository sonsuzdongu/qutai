// yourlocal · Lokanta Moda: a made-up food delivery site for recording Qutai videos (video/README.md). No network
// requests, no storage: the cart lives in memory for the visit. Turkish by default, English with ?lang=en.
// Nothing is ever ordered or paid: the payment step shows a saved card that exists only on this page, "paying" with it
// just shows the confirmation, and the form for another card has no action and sends nothing anywhere.
const EN = new URLSearchParams(location.search).get('lang') === 'en';
// ?r=sofra shows a second made-up restaurant (other name, prices and a delivery fee), so two tabs can be compared.
const SOFRA = new URLSearchParams(location.search).get('r') === 'sofra';
if (SOFRA) {
  document.documentElement.classList.add('sofra');
  document.title = 'Sofra Ocakbaşı · yourlocal';
}
document.documentElement.lang = EN ? 'en' : 'tr';

const T = {
  where: ['Moda, Kadıköy', 'Moda, Kadıköy'],
  cart: ['Sepet', 'Cart'],
  footer: ['Yardım · Gizlilik · Kullanım koşulları', 'Help · Privacy · Terms'],
  restaurant: SOFRA ? ['Sofra Ocakbaşı', 'Sofra Ocakbaşı'] : ['Lokanta Moda', 'Lokanta Moda'],
  cuisine: SOFRA ? ['Ocakbaşı · Pide · Çorba', 'Grill · Pide · Soups'] : ['Ev yemekleri · Türk mutfağı · Glutensiz seçenekler', 'Home cooking · Turkish · Gluten-free options'],
  reviews: SOFRA ? ['(640+ değerlendirme)', '(640+ reviews)'] : ['(1.200+ değerlendirme)', '(1,200+ reviews)'],
  eta: SOFRA ? ['35–45 dk', '35–45 min'] : ['25–35 dk', '25–35 min'],
  free: SOFRA ? ['Teslimat ₺45', 'Delivery ₺45'] : ['Ücretsiz teslimat', 'Free delivery'],
  min: ['Min. sepet ₺150', 'Min. order ₺150'],
  open: ['Açık · 23:00’e kadar', 'Open · until 11 pm'],
  search: ['Menüde ara', 'Search the menu'],
  searchPh: ['Yemek ya da içerik ara', 'Search dishes'],
  gfOnly: ['Yalnızca glutensiz', 'Gluten-free only'],
  gf: ['Glutensiz', 'Gluten-free'],
  popular: ['Popüler', 'Popular'],
  add: ['Sepete ekle', 'Add to cart'],
  added: ['Sepete eklendi: ', 'Added to cart: '],
  none: ['Aramanızla eşleşen yemek yok.', 'No dishes match your search.'],
  items: [(n) => `${n} ürün`, (n) => `${n} item${n === 1 ? '' : 's'}`],
  viewCart: ['Sepete git', 'View cart'],
  cartTitle: ['Sepetiniz', 'Your cart'],
  cartEmpty: ['Sepetiniz boş. Menüden bir şeyler ekleyin.', 'Your cart is empty. Add something from the menu.'],
  backToMenu: ['Menüye dön', 'Back to the menu'],
  less: ['Bir azalt', 'One less'],
  more: ['Bir artır', 'One more'],
  subtotal: ['Ara toplam', 'Subtotal'],
  deliveryFee: ['Teslimat ücreti', 'Delivery fee'],
  freeFee: ['Ücretsiz', 'Free'],
  total: ['Toplam', 'Total'],
  toCheckout: ['Teslimat bilgilerine geç', 'Continue to delivery'],
  deliveryTitle: ['Teslimat bilgileri', 'Delivery details'],
  name: ['Ad soyad', 'Full name'],
  address: ['Teslimat adresi', 'Delivery address'],
  phone: ['Telefon', 'Phone'],
  when: ['Teslimat zamanı', 'Delivery time'],
  asap: ['En kısa sürede (25–35 dk)', 'As soon as possible (25–35 min)'],
  slot: [(h) => `Bugün ${h}`, (h) => `Today ${h}`],
  note: ['Restorana not (isteğe bağlı)', 'Note for the restaurant (optional)'],
  notePh: ['Alerjiler, zil çalışmıyor…', 'Allergies, doorbell broken…'],
  toPayment: ['Ödemeye geç', 'Continue to payment'],
  required: ['Lütfen ad, adres ve telefonu doldurun.', 'Please fill in name, address and phone.'],
  paymentTitle: ['Ödeme', 'Payment'],
  card: ['Kart numarası', 'Card number'],
  expiry: ['Son kullanma tarihi', 'Expiry date'],
  cvc: ['Güvenlik kodu', 'Security code'],
  pay: [(s) => `${s} öde`, (s) => `Pay ${s}`],
  savedCard: ['Kayıtlı kart', 'Saved card'],
  cardName: ['Visa •••• 4242', 'Visa •••• 4242'],
  cardExp: ['Son kullanma 08/29', 'Expires 08/29'],
  otherCard: ['Başka bir kart kullan', 'Use a different card'],
  oneClick: ['Tek dokunuşla öde: kayıtlı kartınız kullanılır.', 'One-tap checkout: your saved card is used.'],
  doneTitle: ['Siparişiniz alındı', 'Order placed'],
  doneBody: [(n, w) => `Teşekkürler ${n}! ${SOFRA ? 'Sofra Ocakbaşı' : 'Lokanta Moda'} siparişinizi hazırlıyor. Teslimat: ${w}.`, (n, w) => `Thanks, ${n}! ${SOFRA ? 'Sofra Ocakbaşı' : 'Lokanta Moda'} is preparing your order. Delivery: ${w}.`],
  paidWith: [(c, s) => `${c} ile ${s} ödendi`, (c, s) => `Paid ${s} with ${c}`],
  orderNo: ['Sipariş no', 'Order no.'],
  payFail: ['Ödeme şu anda alınamıyor. Lütfen biraz sonra tekrar deneyin.', 'We can’t take payments right now. Please try again shortly.'],
  deliverTo: ['Teslimat', 'Delivering to'],
  steps: [['Sepet', 'Teslimat', 'Ödeme'], ['Cart', 'Delivery', 'Payment']],
};
const t = (k, ...a) => {
  const v = T[k][EN ? 1 : 0];
  return typeof v === 'function' ? v(...a) : v;
};
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
for (const el of document.querySelectorAll('[data-t]')) el.textContent = t(el.dataset.t);
const money = (n) => (EN ? `₺${n.toLocaleString('en')}` : `₺${n.toLocaleString('tr')}`);

const CATS = [
  { id: 'soups', tr: 'Çorbalar', en: 'Soups' },
  { id: 'pide', tr: 'Pide ve lahmacun', en: 'Pide and lahmacun' },
  { id: 'mains', tr: 'Ana yemekler', en: 'Mains' },
  { id: 'cold', tr: 'Zeytinyağlılar ve salatalar', en: 'Olive oil dishes and salads' },
  { id: 'sweet', tr: 'Tatlılar', en: 'Desserts' },
];
const MENU = [
  { id: 1, cat: 'soups', art: 'soup', pop: true, tr: ['Mercimek çorbası', 'Kırmızı mercimek, havuç, kimyon, limon'], en: ['Lentil soup', 'Red lentils, carrot, cumin, lemon'], price: 120, gf: true },
  { id: 2, cat: 'pide', art: 'lahmacun', pop: true, tr: ['Lahmacun', 'İnce hamur, kıymalı harç, maydanoz'], en: ['Lahmacun', 'Thin dough, minced meat topping, parsley'], price: 140, gf: false },
  { id: 4, cat: 'pide', art: 'pide', tr: ['Kıymalı pide', 'Taş fırında, kıymalı, tereyağlı'], en: ['Minced meat pide', 'Stone-oven flatbread, minced meat, butter'], price: 260, gf: false },
  { id: 3, cat: 'mains', art: 'skewer', pop: true, tr: ['Tavuk şiş, pilav', 'Izgara tavuk, tereyağlı pirinç pilavı, közlenmiş biber'], en: ['Chicken skewer with rice', 'Grilled chicken, buttered rice pilaf, roasted pepper'], price: 290, gf: true },
  { id: 5, cat: 'mains', art: 'kebab', tr: ['Patlıcan kebabı, pilav', 'Közde patlıcan, ekmek kırıntısız köfte, pirinç pilavı'], en: ['Aubergine kebab with rice', 'Grilled aubergine, meatballs without breadcrumbs, rice pilaf'], price: 320, gf: true },
  { id: 6, cat: 'mains', art: 'manti', tr: ['Mantı', 'El açması, sarımsaklı yoğurt, tereyağlı sos'], en: ['Mantı', 'Hand-made dumplings, garlic yoghurt, butter sauce'], price: 270, gf: false },
  { id: 7, cat: 'cold', art: 'artichoke', tr: ['Zeytinyağlı enginar', 'Enginar, bezelye, havuç, dereotu'], en: ['Artichokes in olive oil', 'Artichoke, peas, carrot, dill'], price: 180, gf: true },
  { id: 8, cat: 'cold', art: 'salad', tr: ['Mevsim salatası', 'Domates, salatalık, roka, nar ekşisi'], en: ['Seasonal salad', 'Tomato, cucumber, rocket, pomegranate molasses'], price: 110, gf: true },
  { id: 9, cat: 'sweet', art: 'pudding', tr: ['Fırın sütlaç', 'Pirinç, süt, tarçın'], en: ['Baked rice pudding', 'Rice, milk, cinnamon'], price: 100, gf: true },
  { id: 10, cat: 'sweet', art: 'baklava', pop: true, tr: ['Fıstıklı baklava', 'Dört dilim, Antep fıstığı'], en: ['Pistachio baklava', 'Four pieces, Antep pistachio'], price: 160, gf: false },
];
// Sofra's prices: cheaper dishes, but a delivery fee and a longer wait.
const SOFRA_PRICE = { 1: 105, 2: 120, 4: 240, 3: 280, 5: 310, 6: 265, 7: 175, 8: 105, 9: 95, 10: 150 };
if (SOFRA) for (const m of MENU) m.price = SOFRA_PRICE[m.id];
const FEE = SOFRA ? 45 : 0;
const label = (m) => m[EN ? 'en' : 'tr'];

// Small drawings of each dish on a plate (inline SVG, nothing loaded).
const ART = {
  soup: '<circle cx="50" cy="50" r="30" fill="#c8551f"/><circle cx="50" cy="50" r="30" fill="url(#g)" opacity=".35"/><path d="M38 44c4-3 8 3 12 0s8-3 12 0" stroke="#f2b25c" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="58" cy="57" r="3" fill="#3f7d3a"/><circle cx="43" cy="58" r="2.5" fill="#3f7d3a"/><path d="M70 30l10-6" stroke="#f4d34f" stroke-width="7" stroke-linecap="round"/>',
  lahmacun: '<circle cx="50" cy="50" r="33" fill="#e8b46a"/><circle cx="50" cy="50" r="28" fill="#b6452a"/><g fill="#7a2a19"><circle cx="40" cy="42" r="3"/><circle cx="57" cy="40" r="3"/><circle cx="62" cy="56" r="3"/><circle cx="45" cy="60" r="3"/><circle cx="51" cy="50" r="2.5"/></g><g fill="#4f8f3a"><circle cx="48" cy="38" r="2"/><circle cx="36" cy="54" r="2"/><circle cx="60" cy="47" r="2"/><circle cx="55" cy="63" r="2"/></g>',
  pide: '<path d="M14 50c10-16 62-16 72 0-10 16-62 16-72 0z" fill="#e1a35a"/><path d="M24 50c9-9 43-9 52 0-9 9-43 9-52 0z" fill="#9c3b22"/><g fill="#6e2416"><circle cx="38" cy="49" r="2.5"/><circle cx="50" cy="47" r="2.5"/><circle cx="62" cy="50" r="2.5"/></g><path d="M44 52h12" stroke="#f6d27a" stroke-width="3" stroke-linecap="round"/>',
  skewer: '<ellipse cx="50" cy="62" rx="24" ry="12" fill="#f3ead3"/><path d="M14 40l72 0" stroke="#8a6a44" stroke-width="2.5"/><g fill="#d08a3a"><rect x="24" y="33" width="11" height="14" rx="4"/><rect x="39" y="33" width="11" height="14" rx="4"/><rect x="54" y="33" width="11" height="14" rx="4"/></g><rect x="68" y="34" width="9" height="12" rx="4" fill="#c6402c"/><path d="M60 64c6-6 14-4 16 2" stroke="#3f7d3a" stroke-width="4" fill="none" stroke-linecap="round"/>',
  kebab: '<ellipse cx="50" cy="62" rx="24" ry="11" fill="#f3ead3"/><g fill="#5b2d4f"><ellipse cx="34" cy="44" rx="9" ry="7"/><ellipse cx="66" cy="44" rx="9" ry="7"/></g><g fill="#8a4a2a"><circle cx="50" cy="44" r="7"/><circle cx="42" cy="38" r="5"/><circle cx="58" cy="38" r="5"/></g><path d="M30 58h40" stroke="#c6402c" stroke-width="4" stroke-linecap="round"/>',
  manti: '<circle cx="50" cy="50" r="30" fill="#f7f1e6"/><g fill="#f0d9a8" stroke="#d9b876" stroke-width="1"><path d="M34 42l6-6 6 6-6 6z"/><path d="M50 38l6-6 6 6-6 6z"/><path d="M44 54l6-6 6 6-6 6z"/><path d="M58 52l6-6 6 6-6 6z"/><path d="M30 56l6-6 6 6-6 6z"/></g><path d="M30 46c10 6 30 8 42 0" stroke="#c4471f" stroke-width="3" fill="none" opacity=".8"/>',
  artichoke: '<circle cx="50" cy="50" r="30" fill="#f6edd1"/><g fill="#9bb85a"><circle cx="40" cy="46" r="9"/><circle cx="60" cy="46" r="9"/><circle cx="50" cy="60" r="9"/></g><g fill="#e7d38a"><circle cx="40" cy="46" r="4"/><circle cx="60" cy="46" r="4"/><circle cx="50" cy="60" r="4"/></g><g fill="#5f9d3e"><circle cx="30" cy="58" r="2.5"/><circle cx="70" cy="60" r="2.5"/><circle cx="50" cy="38" r="2.5"/></g><path d="M64 64l8 4" stroke="#e58a2b" stroke-width="4" stroke-linecap="round"/>',
  salad: '<circle cx="50" cy="50" r="30" fill="#e9f1dc"/><g fill="#5f9d3e"><path d="M30 46c6-10 16-8 18 0-8 4-14 4-18 0z"/><path d="M52 60c6-10 16-8 18 0-8 4-14 4-18 0z"/></g><g fill="#d63b2b"><circle cx="58" cy="42" r="6"/><circle cx="40" cy="60" r="6"/></g><g fill="#b9d98a"><circle cx="50" cy="50" r="5"/><circle cx="66" cy="54" r="4"/></g><g fill="#8e1f3a"><circle cx="46" cy="40" r="1.8"/><circle cx="62" cy="62" r="1.8"/><circle cx="34" cy="52" r="1.8"/></g>',
  pudding: '<ellipse cx="50" cy="56" rx="26" ry="20" fill="#7a4a2a"/><ellipse cx="50" cy="50" rx="24" ry="15" fill="#f5ead2"/><ellipse cx="50" cy="48" rx="14" ry="8" fill="#c9884a" opacity=".85"/><ellipse cx="47" cy="47" rx="6" ry="3" fill="#a85f2b" opacity=".8"/>',
  baklava: '<rect x="22" y="36" width="56" height="28" rx="3" fill="#f3ead3"/><g fill="#d79a3b" stroke="#b5762a" stroke-width="1"><path d="M26 40h12l-6 10z"/><path d="M42 40h12l-6 10z"/><path d="M58 40h12l-6 10z"/><path d="M34 60h12l-6-10z"/><path d="M50 60h12l-6-10z"/></g><g fill="#6aa23d"><circle cx="32" cy="44" r="1.8"/><circle cx="48" cy="44" r="1.8"/><circle cx="64" cy="44" r="1.8"/><circle cx="40" cy="56" r="1.8"/><circle cx="56" cy="56" r="1.8"/></g>',
};
const artSvg = (kind) =>
  `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="g"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><circle cx="50" cy="50" r="44" fill="#fff" stroke="#e9e3d8" stroke-width="2"/>${ART[kind]}</svg>`;

const state = { q: '', gfOnly: false, cart: new Map(), delivery: null };
const app = document.getElementById('app');
const count = document.getElementById('cart-count');
const bar = document.getElementById('cartbar');

function matches(m) {
  const [name, desc] = label(m);
  const hay = `${name} ${desc} ${m.gf ? `${T.gf[0]} ${T.gf[1]} glutensiz gluten-free gluten free` : ''}`.toLocaleLowerCase(EN ? 'en' : 'tr');
  const words = state.q.toLocaleLowerCase(EN ? 'en' : 'tr').split(/\s+/).filter(Boolean);
  return (!state.gfOnly || m.gf) && words.every((w) => hay.includes(w));
}

const star = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l3 6.6 7.2.7-5.4 4.8 1.6 7.1L12 17.6 5.6 21.2l1.6-7.1L1.8 9.3 9 8.6z"/></svg>';

function menuView() {
  app.innerHTML = `
    <section class="hero">
      <div class="cover" aria-hidden="true"></div>
      <div class="hero-card">
        <div class="mark" aria-hidden="true">${SOFRA ? 'SO' : 'LM'}</div>
        <h1>${t('restaurant')}</h1>
        <p class="cuisine">${t('cuisine')}</p>
        <p class="facts"><span class="rating">${star} ${SOFRA ? (EN ? '4.6' : '4,6') : EN ? '4.8' : '4,8'} <span class="muted">${t('reviews')}</span></span></p>
        <ul class="chips">
          <li>${t('eta')}</li><li${SOFRA ? '' : ' class="good"'}>${t('free')}</li><li>${t('min')}</li><li>${t('open')}</li>
        </ul>
      </div>
    </section>
    <form class="search" role="search" onsubmit="return false">
      <label><span class="sr">${t('search')}</span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 3a7 7 0 1 0 4.2 12.6l5 5 1.4-1.4-5-5A7 7 0 0 0 10 3zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10z"/></svg>
        <input type="search" id="q" name="q" placeholder="${t('searchPh')}" value="${esc(state.q)}"></label>
      <label class="toggle"><input type="checkbox" id="gf" ${state.gfOnly ? 'checked' : ''}><span>${t('gfOnly')}</span></label>
    </form>
    <nav class="tabs" aria-label="${EN ? 'Menu sections' : 'Menü bölümleri'}">${CATS.map((c) => `<a href="#menu" data-cat="${c.id}">${c[EN ? 'en' : 'tr']}</a>`).join('')}</nav>
    <p id="status" role="status" class="status"></p>
    <div id="list"></div>`;
  const list = document.getElementById('list');
  const draw = () => {
    const shown = MENU.filter(matches);
    list.innerHTML = CATS.map((c) => {
      const items = shown.filter((m) => m.cat === c.id);
      if (!items.length) return '';
      return `<section class="cat" id="cat-${c.id}"><h2>${c[EN ? 'en' : 'tr']}</h2><ul class="menu">${items
        .map((m) => {
          const [name, desc] = label(m);
          return `<li class="item"><div class="txt"><h3>${name}</h3><p>${desc}</p><p class="meta"><span class="price">${money(m.price)}</span>${
            m.gf ? `<span class="tag gf">${t('gf')}</span>` : ''
          }${m.pop ? `<span class="tag pop">${t('popular')}</span>` : ''}</p></div><div class="pic">${artSvg(m.art)}<button class="add" data-id="${m.id}" aria-label="${t('add')}: ${name}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg></button></div></li>`;
        })
        .join('')}</ul></section>`;
    }).join('');
    document.getElementById('status').textContent = shown.length ? '' : t('none');
  };
  draw();
  document.getElementById('q').addEventListener('input', (e) => {
    state.q = e.target.value;
    draw();
  });
  document.getElementById('gf').addEventListener('change', (e) => {
    state.gfOnly = e.target.checked;
    draw();
  });
  app.querySelector('.tabs').addEventListener('click', (e) => {
    const a = e.target.closest('a[data-cat]');
    if (!a) return;
    e.preventDefault();
    document.getElementById(`cat-${a.dataset.cat}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  list.addEventListener('click', (e) => {
    const b = e.target.closest('button.add');
    if (!b) return;
    const id = Number(b.dataset.id);
    state.cart.set(id, (state.cart.get(id) ?? 0) + 1);
    updateCount();
    b.classList.remove('pop');
    void b.offsetWidth;
    b.classList.add('pop');
    document.getElementById('status').textContent = t('added') + label(MENU.find((m) => m.id === id))[0];
  });
}

function totals() {
  let n = 0;
  let sum = 0;
  for (const [id, q] of state.cart) {
    n += q;
    sum += MENU.find((x) => x.id === id).price * q;
  }
  return { n, sum };
}

function summary(editable) {
  const rows = [...state.cart].map(([id, q]) => {
    const m = MENU.find((x) => x.id === id);
    const [name] = label(m);
    const qty = editable
      ? `<span class="qty"><button data-dec="${id}" aria-label="${t('less')}: ${name}">−</button><b>${q}</b><button data-inc="${id}" aria-label="${t('more')}: ${name}">+</button></span>`
      : `<b class="qn">${q}×</b>`;
    return `<li><span class="thumb">${artSvg(m.art)}</span><span class="nm">${name}</span>${qty}<span class="amt">${money(m.price * q)}</span></li>`;
  });
  const { sum } = totals();
  return `<ul class="lines">${rows.join('')}</ul>
    <dl class="sums"><dt>${t('subtotal')}</dt><dd>${money(sum)}</dd><dt>${t('deliveryFee')}</dt>${FEE ? `<dd>${money(FEE)}</dd>` : `<dd class="good">${t('freeFee')}</dd>`}<dt class="tot">${t('total')}</dt><dd class="tot">${money(sum + FEE)}</dd></dl>`;
}

const stepper = (i) =>
  `<ol class="steps">${t('steps').map((s, j) => `<li class="${j < i ? 'done' : j === i ? 'now' : ''}"${j === i ? ' aria-current="step"' : ''}>${s}</li>`).join('')}</ol>`;

function cartView() {
  if (!state.cart.size) {
    app.innerHTML = `${stepper(0)}<h1>${t('cartTitle')}</h1><p class="status">${t('cartEmpty')}</p><a class="primary" href="#menu">${t('backToMenu')}</a>`;
    return;
  }
  app.innerHTML = `${stepper(0)}<h1>${t('cartTitle')}</h1><p class="from">${t('restaurant')}</p>${summary(true)}<a class="primary" href="#delivery">${t('toCheckout')}</a>`;
  app.querySelector('.lines').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const id = Number(b.dataset.inc || b.dataset.dec);
    const q = (state.cart.get(id) ?? 0) + (b.dataset.inc ? 1 : -1);
    if (q > 0) state.cart.set(id, q);
    else state.cart.delete(id);
    updateCount();
    cartView();
  });
}

function deliveryView() {
  const d = state.delivery ?? {};
  const slots = ['19:00', '19:30', '20:00', '20:30', '21:00'];
  app.innerHTML = `
    ${stepper(1)}
    <h1>${t('deliveryTitle')}</h1>
    <form id="delivery" class="card" novalidate>
      <label>${t('name')}<input name="name" autocomplete="name" required value="${esc(d.name)}"></label>
      <label>${t('address')}<textarea name="address" autocomplete="street-address" rows="3" required>${esc(d.address)}</textarea></label>
      <label>${t('phone')}<input name="phone" type="tel" autocomplete="tel" required value="${esc(d.phone)}"></label>
      <label>${t('when')}<select name="when">${[`<option value="asap">${t('asap')}</option>`, ...slots.map((h) => `<option value="${h}"${d.when === h ? ' selected' : ''}>${t('slot', h)}</option>`)].join('')}</select></label>
      <label>${t('note')}<textarea name="note" rows="2" placeholder="${t('notePh')}">${esc(d.note)}</textarea></label>
      <p id="err" role="alert"></p>
      <button class="primary" type="submit">${t('toPayment')}</button>
    </form>`;
  document.getElementById('delivery').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    if (!f.name.trim() || !f.address.trim() || !f.phone.trim()) {
      document.getElementById('err').textContent = t('required');
      return;
    }
    state.delivery = f;
    location.hash = '#payment';
  });
}

function paymentView() {
  if (!state.delivery) {
    location.hash = '#delivery';
    return;
  }
  const d = state.delivery;
  const when = d.when && d.when !== 'asap' ? t('slot', d.when) : t('asap');
  app.innerHTML = `
    ${stepper(2)}
    <h1>${t('paymentTitle')}</h1>
    <div class="card"><p class="to"><b>${t('deliverTo')}</b><br>${esc(d.name)} · ${esc(d.phone)}<br>${esc(d.address)}<br><span class="muted">${esc(when)}</span></p></div>
    <div class="card">${summary(false)}</div>
    <form id="pay" class="card" novalidate>
      <p class="label">${t('savedCard')}</p>
      <label class="saved"><input type="radio" name="method" value="saved" checked>
        <span class="cardmark" aria-hidden="true">VISA</span><span><b>${t('cardName')}</b><br><span class="muted">${t('cardExp')}</span></span></label>
      <label class="saved"><input type="radio" name="method" value="other"><span>${t('otherCard')}</span></label>
      <div id="other" hidden>
        <label>${t('card')}<input autocomplete="cc-number" inputmode="numeric" placeholder="0000 0000 0000 0000"></label>
        <div class="two">
          <label>${t('expiry')}<input autocomplete="cc-exp" placeholder="${EN ? 'MM/YY' : 'AA/YY'}"></label>
          <label>${t('cvc')}<input autocomplete="cc-csc" inputmode="numeric" placeholder="123"></label>
        </div>
      </div>
      <p class="muted small">${t('oneClick')}</p>
      <button class="primary" type="submit">${t('pay', money(totals().sum + FEE))}</button>
      <p id="paynote" role="alert"></p>
    </form>`;
  const form = document.getElementById('pay');
  form.addEventListener('change', () => {
    document.getElementById('other').hidden = form.method.value !== 'other';
  });
  // The other-card fields have no names and the form no action: nothing typed here goes anywhere. The saved card is
  // only text on this page; "paying" with it shows the confirmation and charges nothing.
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (form.method.value !== 'saved') {
      document.getElementById('paynote').textContent = t('payFail');
      return;
    }
    state.paid = { sum: totals().sum + FEE, when, name: d.name.trim().split(/\s+/)[0] };
    location.hash = '#done';
  });
}

function doneView() {
  if (!state.paid) {
    location.hash = '#menu';
    return;
  }
  const p = state.paid;
  app.innerHTML = `
    ${stepper(3)}
    <div class="done">
      <span class="tick" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>
      <h1>${t('doneTitle')}</h1>
      <p>${esc(t('doneBody', p.name, p.when))}</p>
      <div class="card"><p class="to">${t('paidWith', t('cardName'), money(p.sum))}<br><span class="muted">${t('orderNo')} 48213</span></p></div>
    </div>`;
  state.cart.clear();
}

function updateCount() {
  const { n, sum } = totals();
  count.textContent = n;
  count.classList.toggle('on', n > 0);
  const onMenu = !['#cart', '#delivery', '#payment', '#done'].includes(location.hash);
  bar.hidden = !(n > 0 && onMenu);
  bar.innerHTML = `<span class="bn">${n}</span><span>${t('viewCart')}</span><span>${money(sum)}</span>`;
}

function route() {
  const view = { '#cart': cartView, '#delivery': deliveryView, '#payment': paymentView, '#done': doneView }[location.hash] ?? menuView;
  view();
  updateCount();
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
route();
